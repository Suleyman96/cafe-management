/**
 * Fix for @types/react@19.1.x incompatibility with React Native class components.
 *
 * React 19 types require class components to satisfy JSX.ElementClass which extends
 * React.Component<any>. React Native components like View use an intersection type
 * (NativeMethods & ViewComponent) that doesn't satisfy this constraint due to missing
 * inherited properties (like `refs`) in the intersection.
 *
 * This widens JSX.ElementClass to accept any object with a render() method.
 */

import type { ReactNode } from 'react';

declare global {
  namespace JSX {
    interface ElementClass {
      render(): ReactNode;
    }
  }
}
