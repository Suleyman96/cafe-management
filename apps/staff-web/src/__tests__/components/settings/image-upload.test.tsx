/**
 * ImageUpload — i18n string extraction (audit #11).
 *
 * The drop-zone labels, default label, and alt text were hardcoded English.
 * They now route through `t('imageUpload.*')`. The staff-web test mock returns
 * the key when a translation isn't in its table, so asserting the keys appear
 * proves the strings go through i18n rather than being hardcoded.
 */

import { ImageUpload } from '@/components/settings/image-upload';
import { renderWithProviders, screen } from '../../helpers/test-utils';

describe('ImageUpload — i18n (audit #11)', () => {
  it('renders the upload-state labels via imageUpload.* keys', () => {
    renderWithProviders(<ImageUpload value={null} onChange={() => {}} />);

    expect(screen.getByText('imageUpload.clickToUpload')).toBeInTheDocument();
    expect(screen.getByText('imageUpload.orDragAndDrop')).toBeInTheDocument();
    expect(screen.getByText('imageUpload.fileHint')).toBeInTheDocument();
  });

  it('uses a translated default label instead of a hardcoded "Upload Image"', () => {
    renderWithProviders(<ImageUpload value={null} onChange={() => {}} />);
    expect(screen.getByText('imageUpload.defaultLabel')).toBeInTheDocument();
  });

  it('lets an explicit (already-localized) label override the default', () => {
    renderWithProviders(<ImageUpload value={null} onChange={() => {}} label="Cafe logo" />);
    expect(screen.getByText('Cafe logo')).toBeInTheDocument();
    expect(screen.queryByText('imageUpload.defaultLabel')).toBeNull();
  });
});
