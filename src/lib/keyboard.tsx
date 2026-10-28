import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform } from 'react-native';

const KeyboardInsetContext = createContext(0);

export function useKeyboardInset() {
  return useContext(KeyboardInsetContext);
}

export function liftFocusedField(target: unknown) {
  if (Platform.OS !== 'web' || target == null || typeof target !== 'object') return;
  const element = target as { scrollIntoView?: (options: ScrollIntoViewOptions) => void };
  if (!element.scrollIntoView) return;
  const run = () => element.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  requestAnimationFrame(run);
  setTimeout(run, 280);
}

export function KeyboardProvider({ children }: { children: ReactNode }) {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return undefined;
      const viewport = window.visualViewport;
      const root = document.getElementById('root');
      const meta = document.querySelector('meta[name="viewport"]');
      if (meta && !meta.getAttribute('content')?.includes('interactive-widget')) {
        meta.setAttribute(
          'content',
          `${meta.getAttribute('content')}, viewport-fit=cover, interactive-widget=resizes-content`,
        );
      }
      const apply = () => {
        if (!viewport) return;
        const overlap = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
        setInset(overlap > 40 ? Math.round(overlap) : 0);
        if (root) {
          root.style.height = `${Math.round(viewport.height)}px`;
          root.style.transform = viewport.offsetTop > 0 ? `translateY(${Math.round(viewport.offsetTop)}px)` : '';
        }
      };
      viewport?.addEventListener('resize', apply);
      viewport?.addEventListener('scroll', apply);
      apply();
      return () => {
        viewport?.removeEventListener('resize', apply);
        viewport?.removeEventListener('scroll', apply);
        if (root) {
          root.style.height = '';
          root.style.transform = '';
        }
      };
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => setInset(event.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return <KeyboardInsetContext.Provider value={inset}>{children}</KeyboardInsetContext.Provider>;
}
