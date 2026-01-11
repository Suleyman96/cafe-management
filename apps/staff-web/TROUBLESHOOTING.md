# Troubleshooting: QueryClient Error

## Error
"No QueryClient set, use QueryClientProvider to set one"

## Solution

The Providers component is set up correctly. Try these steps:

1. **Restart the dev server:**
   ```bash
   cd staff-web
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Clear Next.js cache:**
   ```bash
   cd staff-web
   rm -rf .next
   npm run dev
   ```

3. **Verify Providers is in layout:**
   - Check `src/app/layout.tsx` - it should import and use `<Providers>`
   - Check `src/components/providers.tsx` - it should export QueryClientProvider

4. **If still not working:**
   - Make sure `@tanstack/react-query` is installed: `npm list @tanstack/react-query`
   - Check browser console for other errors
   - Verify the component tree: Providers → children

The setup is correct, this is likely a cache/build issue that a restart will fix.


