// The WorkPods pinwheel, taken from the real brand SVG (`workpods.svg`,
// viewBox 0 0 1000 1000) rather than traced: the four `d` strings below are
// copied verbatim from its four <path> elements, so the mark is the brand
// asset by construction. Regenerate by re-copying from that file, never by
// editing points by hand.
//
// The source's central medallion is two clipped base64 PNGs (1254x1254 each,
// 3.6MB of the file's 3.8MB). Those are pre-composited at build time into
// logo-medallion.webp (2.6KB) instead of being inlined here -- which
// is why the vector part of this file is ~2KB and the medallion is a fetch
// the caller can opt out of with `medallion={false}`.

// no-inline: a data URI would repeat in every logo on a prerendered page.
import medallionUrl from './logo-medallion.webp?no-inline'

// Colors come from tokens (theme/tokens.css), never inline hex -- these are the
// logo's own fills and deliberately not the --pod-* palette.
const SWOOSHES: readonly { readonly token: string; readonly d: string }[] = [
  {
    token: 'var(--logo-red)',
    d:
      'M830.28,490.33c-30.27-71.94-77.44-131.49-141.89-173.52-61.27-39.96-129.98-54.35-' +
      '202.35-56.25-9.56-.25-17.22-13.7-17.38-20.78-.19-8.51,2.97-21.48,10.08-27.39,25.07-' +
      '20.84,53.25-32.05,84.89-39.93,111-27.65,225.47,3.46,307.25,83.41,55.91,54.65,95.6,' +
      '123.91,104.55,201.77,5.46,47.45-30.55,88.66-77.56,85.52-31.2-2.09-55.29-23.54-67.61-' +
      '52.82Z',
  },
  {
    token: 'var(--logo-blue)',
    d:
      'M263.37,511.61c.65,14.64-8.66,25.58-17.72,28.76-35.52,' +
      '12.46-60.99-60.69-71.15-89.49-25.72-72.92-23.47-149.93,8.13-220.95C228.4,127.09,' +
      '319.23,56.42,428.44,30.66c28.31-6.68,56.81-4.99,78.22,16.26,19.74,19.59,25.31,48.83,' +
      '17.51,76.22-6.86,24.08-27.04,41.34-52.56,52.71-132.76,59.12-214.81,188.53-208.24,' +
      '335.76Z',
  },
  {
    token: 'var(--logo-green)',
    d:
      'M527.25,752.34c16.15,30.2-23.62,52.14-48.99,62.01-171.91,' +
      '66.89-354.48-14.65-427.86-179.37-13.36-30-23.11-59.28-26.06-91.71-3.52-38.67,' +
      '19.93-72.12,55.04-80.25,36.76-8.51,71.86,9.42,86.77,45.36,57.72,139.16,182.45,232.01,' +
      '335.22,229.11,10.97-.21,21.6,6.86,25.88,14.85Z',
  },
  {
    token: 'var(--logo-orange)',
    d:
      'M565.17,970.81c-42.83,8.43-79.06-10.08-92.14-49.91-11.41-34.74,8.25-74.33,45.17-90.07,' +
      '141.5-60.32,217.04-186.11,216.75-339.63-.02-11.46,8.4-22.91,18.1-26.88,7.96-3.25,' +
      '25.52-1.69,32.05,7.96,76.24,112.77,71.87,258.44-10.35,366.9-51.57,68.02-124.29,' +
      '114.83-209.58,131.63Z',
  },
]

// The medallion circle, verbatim from the source's <clipPath>.
const MEDALLION = { cx: 500.3, cy: 503.71, r: 102.47 } as const
// The <image>'s own box: the circle's bounding box, which is what
// logo-medallion.webp was cropped to.
const MEDALLION_BOX = { x: 398, y: 401, size: 205 } as const

interface LogoMarkProps {
  readonly size?: number
  readonly medallion?: boolean
}

export function LogoMark({ size = 30, medallion = true }: LogoMarkProps) {
  return (
    <svg
      className="wp-logo"
      width={size}
      height={size}
      viewBox="0 0 1000 1000"
      role="img"
      aria-label="WorkPods logo"
    >
      {medallion ? (
        <clipPath id="wp-logo-medallion-clip">
          <circle cx={MEDALLION.cx} cy={MEDALLION.cy} r={MEDALLION.r} />
        </clipPath>
      ) : null}
      <LogoSwooshes />
      {medallion ? (
        <image
          href={medallionUrl}
          x={MEDALLION_BOX.x}
          y={MEDALLION_BOX.y}
          width={MEDALLION_BOX.size}
          height={MEDALLION_BOX.size}
          clipPath="url(#wp-logo-medallion-clip)"
        />
      ) : null}
    </svg>
  )
}

/** The loading spinner shares the exact vector mark without fetching the medallion. */
export function LogoSwooshes() {
  return (
    <>
      {SWOOSHES.map(({ token, d }) => (
        <path key={token} d={d} fill={token} />
      ))}
    </>
  )
}
