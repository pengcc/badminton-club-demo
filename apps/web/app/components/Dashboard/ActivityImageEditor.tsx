'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@app/components/ui/button';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

interface ActivityImageEditorProps {
  retainedImages: string[];
  newImages: File[];
  onRetainedImagesChange: (images: string[]) => void;
  onNewImagesChange: (images: File[]) => void;
  maxImages?: number;
}

const allowedTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export function ActivityImageEditor({
  retainedImages,
  newImages,
  onRetainedImagesChange,
  onNewImagesChange,
  maxImages = 10,
}: ActivityImageEditorProps) {
  const t = useTranslations('dashboard.cms.activity.images');
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrls = useMemo(
    () => newImages.map((file) => URL.createObjectURL(file)),
    [newImages]
  );

  useEffect(
    () => () => previewUrls.forEach((url) => URL.revokeObjectURL(url)),
    [previewUrls]
  );

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const remaining = maxImages - retainedImages.length - newImages.length;
    if (remaining <= 0) {
      toast.error(t('maximum', { max: maxImages }));
      return;
    }
    const selected = Array.from(files).slice(0, remaining);
    if (selected.some((file) => !allowedTypes.has(file.type))) {
      toast.error(t('types'));
      return;
    }
    if (selected.some((file) => file.size > 5 * 1024 * 1024)) {
      toast.error(t('size'));
      return;
    }
    onNewImagesChange([...newImages, ...selected]);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="sr-only"
        onChange={(event) => addFiles(event.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus className="mr-2 h-4 w-4" />
        {t('add', {
          count: retainedImages.length + newImages.length,
          max: maxImages,
        })}
      </Button>
      {(retainedImages.length > 0 || newImages.length > 0) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {retainedImages.map((url, index) => (
            <div
              key={url}
              className="relative aspect-square overflow-hidden rounded-lg border"
            >
              <Image
                src={url}
                alt={t('existingAlt', { number: index + 1 })}
                fill
                className="object-cover"
                unoptimized
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7"
                aria-label={t('removeExisting', { number: index + 1 })}
                onClick={() =>
                  onRetainedImagesChange(
                    retainedImages.filter((item) => item !== url)
                  )
                }
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {newImages.map((file, index) => (
            <div
              key={`${file.name}-${file.lastModified}-${index}`}
              className="relative aspect-square overflow-hidden rounded-lg border"
            >
              <Image
                src={previewUrls[index]}
                alt={t('newAlt', { number: index + 1 })}
                fill
                className="object-cover"
                unoptimized
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7"
                aria-label={t('removeNew', { number: index + 1 })}
                onClick={() =>
                  onNewImagesChange(
                    newImages.filter((_, itemIndex) => itemIndex !== index)
                  )
                }
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
