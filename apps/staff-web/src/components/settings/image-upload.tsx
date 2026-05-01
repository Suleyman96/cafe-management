'use client';

import { useTranslation } from '@gustri/i18n';
import * as Sentry from '@sentry/nextjs';
import imageCompression from 'browser-image-compression';
import { ImageIcon, Loader2, Upload, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { validateImageFile } from '@/lib/uploads/validate-image';
import { useAuthStore } from '@/store/auth-store';

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  folder?: string;
  label?: string;
  hint?: string;
  aspectRatio?: 'square' | 'wide' | 'tall';
  maxSizeMB?: number;
}

export function ImageUpload({
  value,
  onChange,
  bucket = 'branding',
  folder = 'logos',
  label = 'Upload Image',
  hint,
  aspectRatio = 'square',
  maxSizeMB = 2,
}: ImageUploadProps) {
  const { t } = useTranslation();
  const tenantId = useAuthStore((s) => s.staff?.tenant_id);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const aspectClasses = {
    square: 'aspect-square',
    wide: 'aspect-video',
    tall: 'aspect-[3/4]',
  };

  const handleFile = useCallback(
    async (file: File) => {
      const validation = await validateImageFile(file, { maxSizeMB });
      if (!validation.ok) {
        if (validation.error.kind === 'too_large') {
          toast.error(t('imageUpload.tooLarge', { size: maxSizeMB }));
        } else {
          toast.error(t('imageUpload.invalidType'));
        }
        return;
      }

      if (!tenantId) {
        toast.error(t('imageUpload.uploadFailed'));
        return;
      }

      setIsUploading(true);

      try {
        // Compress and convert to WebP before upload
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          fileType: 'image/webp',
        });

        // Tenant-prefixed path is required by storage RLS (H4 — see
        // supabase/migrations/20260501000001_storage_tenant_scoping.sql).
        const filename = `${tenantId}/${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;

        // Upload compressed file to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filename, compressed, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'image/webp',
          });

        if (uploadError) {
          Sentry.captureException(uploadError);
          toast.error(t('imageUpload.uploadFailed'));
          return;
        }

        // Get public URL
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filename);

        onChange(urlData.publicUrl);
        toast.success(t('imageUpload.uploadSuccess'));
      } catch (err) {
        Sentry.captureException(err);
        toast.error(t('imageUpload.uploadFailed'));
      } finally {
        setIsUploading(false);
      }
    },
    [bucket, folder, maxSizeMB, onChange, t, tenantId],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  const handleRemove = useCallback(async () => {
    if (!value) return;

    try {
      // Extract filename from URL
      const url = new URL(value);
      const pathParts = url.pathname.split('/');
      const filename = pathParts.slice(-2).join('/'); // folder/filename

      // Delete from storage
      await supabase.storage.from(bucket).remove([filename]);

      onChange(null);
      toast.success(t('imageUpload.removed'));
    } catch (err) {
      Sentry.captureException(err);
      // Still clear the value even if deletion fails
      onChange(null);
    }
  }, [value, bucket, onChange, t]);

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}

      {value ? (
        // Preview state
        <div className="relative inline-block">
          <div
            className={`relative ${aspectClasses[aspectRatio]} w-40 bg-gray-100 rounded-lg overflow-hidden border border-gray-200`}
          >
            <Image src={value} alt="Uploaded image" fill className="object-contain" />
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        // Upload state
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`
            relative cursor-pointer rounded-lg border-2 border-dashed p-6 transition-colors
            ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }
            ${isUploading ? 'pointer-events-none opacity-60' : ''}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
          />

          <div className="flex flex-col items-center text-center">
            {isUploading ? (
              <>
                <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-2" />
                <p className="text-sm text-gray-600">Uploading...</p>
              </>
            ) : (
              <>
                <div className="p-3 bg-gray-100 rounded-full mb-3">
                  {dragActive ? (
                    <Upload className="h-6 w-6 text-blue-500" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-gray-400" />
                  )}
                </div>
                <p className="text-sm font-medium text-gray-700">
                  {dragActive ? 'Drop image here' : 'Click to upload'}
                </p>
                <p className="text-xs text-gray-500 mt-1">or drag and drop</p>
                <p className="text-xs text-gray-400 mt-2">PNG, JPG up to {maxSizeMB}MB</p>
              </>
            )}
          </div>
        </div>
      )}

      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
