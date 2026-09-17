'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Calendar, Video, X, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@app/components/ui/dialog';
import type {
  ActivitiesPageData,
  PublicActivity,
} from '@app/lib/data/getActivitiesPageData';
import type { PublicProjectionResult } from '@app/lib/data/publicProjection';
import {
  buildActivitiesPageHref,
  getActivitiesPageTokens,
} from '@app/lib/activitiesPagination';
import { shouldBypassImageOptimization } from '@app/lib/imageOptimization';

interface ActivitiesPageContentProps {
  result: PublicProjectionResult<ActivitiesPageData>;
  lang: string;
}

// ─── Lightbox ────────────────────────────────────────────────────────────────
interface LightboxProps {
  images: string[];
  initialIndex: number;
  onClose: () => void;
  returnFocusTo: HTMLButtonElement;
  labels: {
    title: string;
    image: (index: number) => string;
    close: string;
    previous: string;
    next: string;
  };
}

function Lightbox({
  images,
  initialIndex,
  onClose,
  returnFocusTo,
  labels,
}: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const hasMultiple = images.length > 1;

  const prev = useCallback(() => {
    setIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  }, [images.length]);

  const next = useCallback(() => {
    setIndex((i) => (i === images.length - 1 ? 0 : i + 1));
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [prev, next]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="fixed inset-0 top-0 left-0 flex h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 items-center justify-center rounded-none border-0 bg-black/80 p-4 backdrop-blur-sm sm:max-w-none"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo.focus();
        }}
      >
        <DialogTitle className="sr-only">{labels.title}</DialogTitle>
        {/* Close button */}
        <DialogClose asChild>
          <button
            type="button"
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label={labels.close}
          >
            <X className="h-6 w-6" />
          </button>
        </DialogClose>

        {/* Counter */}
        {hasMultiple && (
          <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-black/50 text-white text-sm">
            {index + 1} / {images.length}
          </div>
        )}

        {/* Prev button */}
        {hasMultiple && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-2 sm:left-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label={labels.previous}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Image — use <img> intentionally: lightbox needs max-h/max-w contain sizing */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[index]}
          alt={labels.image(index)}
          className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg select-none"
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />

        {/* Next button */}
        {hasMultiple && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-2 sm:right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label={labels.next}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Gallery Image ───────────────────────────────────────────────────────────
/** Wrapper for gallery images using next/image with fill inside a sized container */
function GalleryImage({
  src,
  alt,
  className,
  style,
  onClick,
  accessibleName,
}: {
  src: string;
  alt: string;
  className: string;
  style?: React.CSSProperties;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  accessibleName: string;
}) {
  return (
    <button
      type="button"
      className={`relative block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
      style={style}
      onClick={onClick}
      aria-label={accessibleName}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
        className="object-cover cursor-pointer hover:opacity-90 transition-opacity"
        unoptimized={shouldBypassImageOptimization(src)}
      />
    </button>
  );
}

// ─── Image Gallery ───────────────────────────────────────────────────────────
/**
 * Adaptive gallery layout:
 * - 1 image:  centered, constrained
 * - 2 images: side by side (stack on mobile)
 * - 3 images: 1 large + 2 small stacked (stack on mobile)
 * - 4 images: 2×2 grid
 * - 5+ images: 3-column grid (2-col on mobile)
 *
 * Every image is clickable → opens lightbox.
 */
function ImageGallery({
  images,
  name,
  onImageClick,
  imageLabel,
}: {
  images: string[];
  name: string;
  onImageClick: (index: number, trigger: HTMLButtonElement) => void;
  imageLabel: (index: number) => string;
}) {
  const count = images.length;

  const baseClass = 'rounded-lg';

  // Single image — centered, not full-bleed
  if (count === 1) {
    return (
      <div className="flex justify-center">
        <GalleryImage
          src={images[0]}
          alt={name}
          className={`${baseClass} w-full max-w-2xl h-48 sm:h-64 md:h-[28rem]`}
          accessibleName={imageLabel(0)}
          onClick={(event) =>
            onImageClick(0, event.currentTarget as HTMLButtonElement)
          }
        />
      </div>
    );
  }

  // 2 images — side by side; single column on mobile
  if (count === 2) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {images.map((img, i) => (
          <GalleryImage
            key={i}
            src={img}
            alt={`${name} - ${i + 1}`}
            className={`${baseClass} h-48 sm:h-56 md:h-64`}
            accessibleName={imageLabel(i)}
            onClick={(event) =>
              onImageClick(i, event.currentTarget as HTMLButtonElement)
            }
          />
        ))}
      </div>
    );
  }

  // 3 images — feature: 1 large left + 2 stacked right (single col on mobile)
  if (count === 3) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <GalleryImage
          src={images[0]}
          alt={`${name} - 1`}
          className={`${baseClass} h-48 sm:h-full sm:row-span-2`}
          style={{ minHeight: '12rem' }}
          accessibleName={imageLabel(0)}
          onClick={(event) =>
            onImageClick(0, event.currentTarget as HTMLButtonElement)
          }
        />
        <GalleryImage
          src={images[1]}
          alt={`${name} - 2`}
          className={`${baseClass} h-48 sm:h-36 md:h-40`}
          accessibleName={imageLabel(1)}
          onClick={(event) =>
            onImageClick(1, event.currentTarget as HTMLButtonElement)
          }
        />
        <GalleryImage
          src={images[2]}
          alt={`${name} - 3`}
          className={`${baseClass} h-48 sm:h-36 md:h-40`}
          accessibleName={imageLabel(2)}
          onClick={(event) =>
            onImageClick(2, event.currentTarget as HTMLButtonElement)
          }
        />
      </div>
    );
  }

  // 4 images — 2×2 grid (single col on mobile)
  if (count === 4) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {images.map((img, i) => (
          <GalleryImage
            key={i}
            src={img}
            alt={`${name} - ${i + 1}`}
            className={`${baseClass} h-48 sm:h-44 md:h-52`}
            accessibleName={imageLabel(i)}
            onClick={(event) =>
              onImageClick(i, event.currentTarget as HTMLButtonElement)
            }
          />
        ))}
      </div>
    );
  }

  // 5+ images — 3-col grid (2-col on mobile)
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {images.map((img, i) => (
        <GalleryImage
          key={i}
          src={img}
          alt={`${name} - ${i + 1}`}
          className={`${baseClass} h-36 sm:h-40 md:h-48`}
          accessibleName={imageLabel(i)}
          onClick={(event) =>
            onImageClick(i, event.currentTarget as HTMLButtonElement)
          }
        />
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ActivitiesPageContent({
  result,
  lang,
}: ActivitiesPageContentProps) {
  const t = useTranslations('common');
  const pagination = result.status === 'ready' ? result.data.pagination : null;
  const outOfRangePage =
    pagination && pagination.page > 1 && pagination.page > pagination.totalPages
      ? pagination.page
      : null;
  const recoveryPage =
    pagination && pagination.totalPages > 0 ? pagination.totalPages : 1;
  const [lightbox, setLightbox] = useState<{
    images: string[];
    index: number;
    name: string;
    trigger: HTMLButtonElement;
  } | null>(null);

  const openLightbox = (
    activity: PublicActivity,
    imageIndex: number,
    trigger: HTMLButtonElement
  ) => {
    setLightbox({
      images: activity.images,
      index: imageIndex,
      name: activity.name,
      trigger,
    });
  };

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-12">
          {t('activities.pageTitle')}
        </h1>

        {result.status === 'unavailable' ? (
          <p className="text-center text-muted-foreground text-lg">
            {t('activities.unavailable')}
          </p>
        ) : outOfRangePage !== null ? (
          <div className="text-center text-muted-foreground text-lg">
            <p>{t('activities.pageOutOfRange', { page: outOfRangePage })}</p>
            <Link
              href={buildActivitiesPageHref(lang, recoveryPage)}
              className="mt-4 inline-flex text-primary hover:underline"
            >
              {t('activities.returnToAvailable')}
            </Link>
          </div>
        ) : result.data.activities.length === 0 ? (
          <p className="text-center text-muted-foreground text-lg">
            {t('activities.noActivities')}
          </p>
        ) : (
          <div className="space-y-10">
            {result.data.activities.map((activity) => (
              <div
                key={activity.id}
                className="bg-card rounded-lg border border-border shadow-sm p-5 sm:p-6"
              >
                {/* 1. Title */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                    {activity.name}
                  </h2>
                </div>

                {/* 2. Description (optional) */}
                {activity.description && (
                  <p className="text-sm sm:text-base text-muted-foreground whitespace-pre-line mb-5">
                    {activity.description}
                  </p>
                )}

                {/* 3. Image Gallery */}
                {activity.images.length > 0 && (
                  <div className="mb-5">
                    <ImageGallery
                      images={activity.images}
                      name={activity.name}
                      imageLabel={(i) =>
                        t('activities.openImage', {
                          number: i + 1,
                          name: activity.name,
                        })
                      }
                      onImageClick={(i, trigger) =>
                        openLightbox(activity, i, trigger)
                      }
                    />
                  </div>
                )}

                {/* 4. Video link (optional) */}
                {activity.videoLink && (
                  <a
                    href={activity.videoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm sm:text-base text-primary hover:underline"
                  >
                    <Video className="h-4 w-4" />
                    <span>
                      {activity.videoDescription || t('activities.watchVideo')}
                    </span>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {result.status === 'ready' &&
          outOfRangePage === null &&
          result.data.pagination.totalPages > 1 && (
            <nav
              className="flex items-center justify-center gap-2 mt-10"
              aria-label={t('activities.pagination')}
            >
              {/* Previous */}
              {result.data.pagination.page > 1 ? (
                <Link
                  href={buildActivitiesPageHref(
                    lang,
                    result.data.pagination.page - 1
                  )}
                  aria-label={t('activities.previous')}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md border border-border bg-card hover:bg-accent transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {t('activities.previous')}
                  </span>
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  aria-label={t('activities.previous')}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md border border-border bg-card opacity-50 cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {t('activities.previous')}
                  </span>
                </span>
              )}

              <span className="min-w-24 text-center text-sm font-medium sm:hidden">
                {t('activities.pageStatus', {
                  page: result.data.pagination.page,
                  total: result.data.pagination.totalPages,
                })}
              </span>

              {/* Bounded desktop page numbers */}
              <span className="hidden items-center gap-2 sm:flex">
                {getActivitiesPageTokens(
                  result.data.pagination.page,
                  result.data.pagination.totalPages
                ).map((token, index) =>
                  token === 'ellipsis' ? (
                    <span
                      key={`ellipsis-${index}`}
                      aria-hidden="true"
                      className="inline-flex h-10 w-6 items-center justify-center text-muted-foreground"
                    >
                      …
                    </span>
                  ) : (
                    <Link
                      key={token}
                      href={buildActivitiesPageHref(lang, token)}
                      className={`inline-flex items-center justify-center w-10 h-10 text-sm rounded-md border transition-colors ${
                        token === result.data.pagination.page
                          ? 'border-primary bg-primary text-primary-foreground font-semibold'
                          : 'border-border bg-card hover:bg-accent'
                      }`}
                      aria-label={t('activities.page', { page: token })}
                      aria-current={
                        token === result.data.pagination.page
                          ? 'page'
                          : undefined
                      }
                    >
                      {token}
                    </Link>
                  )
                )}
              </span>

              {/* Next */}
              {result.data.pagination.page <
              result.data.pagination.totalPages ? (
                <Link
                  href={buildActivitiesPageHref(
                    lang,
                    result.data.pagination.page + 1
                  )}
                  aria-label={t('activities.next')}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md border border-border bg-card hover:bg-accent transition-colors"
                >
                  <span className="hidden sm:inline">
                    {t('activities.next')}
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  aria-label={t('activities.next')}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md border border-border bg-card opacity-50 cursor-not-allowed"
                >
                  <span className="hidden sm:inline">
                    {t('activities.next')}
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </nav>
          )}
      </div>

      {/* Lightbox overlay */}
      {lightbox && (
        <Lightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          returnFocusTo={lightbox.trigger}
          labels={{
            title: t('activities.lightboxTitle', { name: lightbox.name }),
            image: (index) =>
              t('activities.lightboxImage', {
                name: lightbox.name,
                number: index + 1,
                total: lightbox.images.length,
              }),
            close: t('activities.closeGallery'),
            previous: t('activities.previousImage'),
            next: t('activities.nextImage'),
          }}
          onClose={() => setLightbox(null)}
        />
      )}
    </section>
  );
}
