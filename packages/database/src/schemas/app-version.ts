import { z } from 'zod';

/**
 * Response shape for the `get_app_version` RPC. Drives the mobile
 * force-update / maintenance gate at app boot.
 */
export const AppVersionResponseSchema = z.object({
  min_supported_version: z.string(),
  latest_version: z.string(),
  maintenance_mode: z.boolean(),
  maintenance_message: z.string().nullable(),
});
export type AppVersionResponse = z.infer<typeof AppVersionResponseSchema>;
