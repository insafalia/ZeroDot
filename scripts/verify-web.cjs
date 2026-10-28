const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const root = path.resolve(__dirname, '..');
const phone = '9999900001';
const shot = path.join(os.tmpdir(), 'zerodot-fail.png');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

function squash(text) {
  return text.replace(/[\s\u00a0\u202f]/g, '');
}

async function ownerClient() {
  const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.APP_OWNER_EMAIL,
    password: process.env.APP_OWNER_PASSWORD,
  });
  if (error) throw new Error(`Owner sign-in failed: ${error.message}`);
  return supabase;
}

async function resetStudio() {
  const supabase = await ownerClient();
  const { data: clients, error } = await supabase.from('clients').select('id').eq('phone', phone);
  if (error) throw new Error(error.message);
  if (clients?.[0]) {
    const removed = await supabase.from('appointments').delete().eq('client_id', clients[0].id);
    if (removed.error) throw new Error(removed.error.message);
    const deleted = await supabase.from('clients').delete().eq('id', clients[0].id);
    if (deleted.error) throw new Error(deleted.error.message);
  }
  const restored = await supabase.from('services').update({ price_inr: 800, duration_minutes: 45 }).eq('name', 'Haircut').select('id');
  if (restored.error) throw new Error(restored.error.message);
  const slot = await supabase.from('salon_settings').update({ slot_minutes: 30 }).eq('id', 1).select('id');
  if (slot.error) throw new Error(slot.error.message);
  const extra = await supabase.from('services').delete().eq('name', 'Brow tint');
  if (extra.error) throw new Error(extra.error.message);
}

async function run() {
  loadEnv(path.join(root, '.env'));
  loadEnv(path.join(root, '.env.server'));
  await resetStudio();

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const logs = [];
  page.on('pageerror', (error) => logs.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') logs.push(message.text());
  });

  try {
    console.log('open');
    await page.goto('http://localhost:8095', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByTestId('sign-in').waitFor({ timeout: 30000 });
    await page.getByTestId('email').fill(process.env.APP_OWNER_EMAIL);
    await page.getByTestId('password').fill(process.env.APP_OWNER_PASSWORD);
    await page.getByTestId('sign-in').click();
    await page.getByText('Month earnings').waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'New booking' }).waitFor();
    const monthName = await page.getByTestId('month-label').innerText();
    await page.getByTestId('month-prev').click();
    await page.waitForFunction((previous) => {
      const node = document.querySelector('[data-testid="month-label"]');
      return Boolean(node && node.textContent && node.textContent.trim() !== previous.trim());
    }, monthName);
    await page.getByTestId('month-next').click();
    await page.getByText(monthName.trim()).waitFor();
    await page.getByRole('button', { name: 'All filters' }).click();
    await page.getByTestId('filter-status-completed').waitFor({ timeout: 15000 });
    await page.getByTestId('filter-service-all').click();
    await page.getByRole('button', { name: 'Dashboard' }).click();
    await page.getByText("Today's agenda").waitFor();
    console.log('dashboard wide');

    const live = await context.newPage();
    await live.goto('http://localhost:8095/book', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await live.getByTestId('slot-10:30').waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByLabel('Slot interval').fill('25');
    await page.getByTestId('save-settings').click();
    await page.getByText('Saved. The diary is using these hours and this slot interval.').waitFor();
    await live.getByTestId('slot-10:25').waitFor({ timeout: 15000 });
    if (await live.getByTestId('slot-10:30').count()) throw new Error('Old 30 minute slot stayed on the open booking page');
    await page.getByLabel('New service name').fill('Brow tint');
    await page.getByLabel('New service duration').fill('20');
    await page.getByLabel('New service price').fill('600');
    await page.getByTestId('add-service').click();
    await page.getByText('Brow tint added to the menu.').waitFor();
    await live.getByTestId('service-Brow tint').waitFor({ timeout: 15000 });
    await page.getByLabel('Brow tint price').fill('650');
    await page.getByTestId('save-service-Brow tint').click();
    await page.getByText('Brow tint saved. New bookings use this price.').waitFor();
    await live.waitForFunction(
      () => {
        const node = document.querySelector('[data-testid="service-Brow tint"]');
        return Boolean(node && node.textContent && node.textContent.replace(/\s/g, '').includes('650'));
      },
      null,
      { timeout: 15000 },
    );
    await live.getByTestId('service-Brow tint').click();
    await live.getByTestId('price').waitFor();
    const livePrice = await live.getByTestId('price').inputValue();
    if (livePrice !== '650') throw new Error(`Open booking did not pick up the edited price, got ${livePrice}`);
    await page.getByTestId('delete-service-Brow tint').click();
    await page.getByRole('button', { name: 'Delete Brow tint' }).click();
    await page.getByText('Brow tint removed. Past visits keep the name and price they were booked with.').waitFor();
    await live.getByTestId('service-Brow tint').waitFor({ state: 'detached', timeout: 15000 });
    await page.getByLabel('Slot interval').fill('30');
    await page.getByTestId('save-settings').click();
    await live.getByTestId('slot-10:30').waitFor({ timeout: 15000 });
    await live.close();
    console.log('live slot and menu');

    await page.getByRole('button', { name: 'Dashboard' }).click();
    await page.getByRole('button', { name: 'New booking' }).click();
    await page.getByTestId('phone').waitFor();
    await page.getByTestId('phone').fill(phone);
    await page.getByTestId('service-Haircut').click();
    await page.getByTestId('price').waitFor();
    const catalogPrice = await page.getByTestId('price').inputValue();
    if (catalogPrice !== '800') throw new Error(`Expected catalog price 800, got ${catalogPrice}`);
    await page.getByTestId('price').fill('900');
    await page.getByTestId('slot-10:00').click();
    await page.getByTestId('save-booking').click();
    await page.getByText('+91 99999 00001').waitFor({ timeout: 20000 });
    let body = squash(await page.locator('body').innerText());
    if (!body.includes('₹900')) throw new Error('Booked visit price was not ₹900');
    console.log('booked number only');

    await page
      .getByText('+91 99999 00001', { exact: true })
      .locator('xpath=ancestor::*[.//*[@aria-label="Completed"]][1]')
      .getByRole('button', { name: 'Completed' })
      .click();
    await page.waitForTimeout(1200);
    body = squash(await page.locator('body').innerText());
    if (!body.includes('₹900')) throw new Error("Today's earnings did not include ₹900");
    console.log('status updated');

    await page.getByRole('button', { name: 'Clients' }).click();
    await page.getByLabel('Search').fill('99999');
    await page.getByText('+91 99999 00001').waitFor({ timeout: 10000 });
    console.log('search by number');

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByLabel('Haircut price').waitFor();
    await page.getByLabel('Haircut price').fill('850');
    await page.getByTestId('save-service-Haircut').click();
    await page.getByText('Haircut saved. New bookings use this price.').waitFor();
    console.log('catalog price saved');

    await page.getByRole('button', { name: 'Dashboard' }).click();
    await page.getByText('+91 99999 00001').click();
    await page.getByTestId('price').waitFor();
    const kept = await page.getByTestId('price').inputValue();
    if (kept !== '900') throw new Error(`Existing visit price changed to ${kept}`);
    await page.getByTestId('client-name').fill('Meera Test');
    await page.getByTestId('save-booking').click();
    await page.getByText('Meera Test').waitFor({ timeout: 20000 });
    console.log('name added without rewriting price');

    await page.getByRole('button', { name: 'Clients' }).click();
    await page.getByLabel('Search').fill('Meera');
    await page.getByText('Meera Test').waitFor();
    await page.getByText('Meera Test').click();
    await page.getByText('Total spent').waitFor();
    body = squash(await page.locator('body').innerText());
    if (!body.includes('₹900')) throw new Error('Client total spent was not ₹900');
    console.log('search by name and total spent');

    await page.getByRole('button', { name: 'New booking' }).click();
    await page.getByTestId('service-Haircut').click();
    await page.getByTestId('price').waitFor();
    const nextPrice = await page.getByTestId('price').inputValue();
    if (nextPrice !== '850') throw new Error(`Next booking did not use the new menu price, got ${nextPrice}`);
    await page.getByTestId('phone').fill(phone);
    await page.getByTestId('slot-10:00').click();
    await page.getByText(/Overlaps/).waitFor();
    console.log('overlap warning and new menu price');
    await page.getByRole('button', { name: 'Close' }).click();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Book', exact: true }).waitFor({ timeout: 20000 });
    if (await page.getByRole('button', { name: 'New booking' }).count()) {
      throw new Error('Desktop sidebar booking button is visible on a phone width');
    }
    console.log('mobile bottom bar');
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await page.getByRole('button', { name: 'All filters' }).click();
    await page.getByTestId('filter-status-completed').waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: 'Back to today' }).click();
    await page.getByText("Today's agenda").waitFor();
    console.log('mobile reports');
    console.log('ok');
  } catch (error) {
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    console.error(logs.slice(0, 12).join('\n'));
    throw error;
  } finally {
    await browser.close();
    await resetStudio();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
