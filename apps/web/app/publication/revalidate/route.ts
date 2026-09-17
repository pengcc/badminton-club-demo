import { revalidatePath, revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  publicationRequestSchema,
  type PublicationTarget,
} from '@club/shared-types/api/publication';
import { Capability } from '@club/shared-types/core/enums';
import { ORDINARY_AUTH_SESSION_COOKIE } from '@club/shared-types/core/authSession';
import { PUBLIC_DOCUMENT_CACHE_TAG } from '@app/lib/data/publicDocumentCache';
import { getServerApiBaseUrl } from '@app/lib/api/baseUrl';
import {
  ACTIVITIES_AVAILABILITY_CACHE_TAG,
  CONTACT_ENTRIES_CACHE_TAG,
  LOCATIONS_CACHE_TAG,
  MEMBERSHIP_INFORMATION_CACHE_TAG,
  RECRUITMENT_INFORMATION_CACHE_TAG,
  TASTER_INFORMATION_CACHE_TAG,
} from '@app/lib/data/publicContentCache';

const PUBLICATION_PATHS: Record<PublicationTarget, readonly string[]> = {
  homepage: ['/de', '/en', '/zh'],
  activities: [
    '/de',
    '/en',
    '/zh',
    '/de/teams',
    '/en/teams',
    '/zh/teams',
    '/de/activities',
    '/en/activities',
    '/zh/activities',
    '/de/membership',
    '/en/membership',
    '/zh/membership',
    '/de/recruitment',
    '/en/recruitment',
    '/zh/recruitment',
    '/de/taster-session',
    '/en/taster-session',
    '/zh/taster-session',
  ],
  teams: ['/de/teams', '/en/teams', '/zh/teams'],
  'public-documents': ['/de', '/en', '/zh'],
  'taster-information': [
    '/de',
    '/en',
    '/zh',
    '/de/taster-session',
    '/en/taster-session',
    '/zh/taster-session',
  ],
  'membership-information': [
    '/de',
    '/en',
    '/zh',
    '/de/membership',
    '/en/membership',
    '/zh/membership',
  ],
  recruitment: ['/de/recruitment', '/en/recruitment', '/zh/recruitment'],
  contact: [
    '/de',
    '/en',
    '/zh',
    '/de/recruitment',
    '/en/recruitment',
    '/zh/recruitment',
  ],
  locations: [
    '/de',
    '/en',
    '/zh',
    '/de/recruitment',
    '/en/recruitment',
    '/zh/recruitment',
  ],
};

function configuredFrontendOrigin(): string | undefined {
  const configured = process.env.FRONTEND_URL;
  if (!configured) return undefined;

  try {
    const url = new URL(configured);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

function isFirstPartyRequest(request: NextRequest): boolean {
  const trustedOrigin = configuredFrontendOrigin();
  if (!trustedOrigin) return false;

  const source =
    request.headers.get('origin') ?? request.headers.get('referer');
  if (!source) return false;

  try {
    return new URL(source).origin === trustedOrigin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isFirstPartyRequest(request)) {
      return NextResponse.json(
        { error: 'First-party request required' },
        { status: 403 }
      );
    }

    const sessionCookie = request.cookies.get(
      ORDINARY_AUTH_SESSION_COOKIE
    )?.value;

    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const verifyResponse = await fetch(
      `${getServerApiBaseUrl()}/api/auth/verify`,
      {
        headers: {
          Cookie: `${ORDINARY_AUTH_SESSION_COOKIE}=${sessionCookie}`,
        },
        cache: 'no-store',
      }
    );

    if (!verifyResponse.ok) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    const { user } = await verifyResponse.json();
    if (!user.capabilities?.includes(Capability.ADMINISTRATION)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const parsed = publicationRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'A supported publication target is required' },
        { status: 400 }
      );
    }

    const paths = PUBLICATION_PATHS[parsed.data.target];
    if (parsed.data.target === 'activities') {
      revalidateTag(ACTIVITIES_AVAILABILITY_CACHE_TAG, { expire: 0 });
    }
    if (parsed.data.target === 'public-documents') {
      revalidateTag(PUBLIC_DOCUMENT_CACHE_TAG, { expire: 0 });
    }
    if (parsed.data.target === 'contact') {
      revalidateTag(CONTACT_ENTRIES_CACHE_TAG, { expire: 0 });
    }
    if (parsed.data.target === 'taster-information') {
      revalidateTag(TASTER_INFORMATION_CACHE_TAG, { expire: 0 });
    }
    if (parsed.data.target === 'membership-information') {
      revalidateTag(MEMBERSHIP_INFORMATION_CACHE_TAG, { expire: 0 });
    }
    if (parsed.data.target === 'recruitment') {
      revalidateTag(RECRUITMENT_INFORMATION_CACHE_TAG, { expire: 0 });
    }
    if (parsed.data.target === 'locations') {
      revalidateTag(LOCATIONS_CACHE_TAG, { expire: 0 });
    }
    for (const path of paths) revalidatePath(path);

    return NextResponse.json({
      revalidated: true,
      target: parsed.data.target,
      paths,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: 'Public refresh failed' },
      { status: 500 }
    );
  }
}
