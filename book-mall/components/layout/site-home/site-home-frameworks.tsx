import Image from "next/image";

const RSPACK_LOGO =
  "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/rspack.png";

/** Semi frameworksWrapper：开始使用按钮下方的技术栈标识 */
export function SiteHomeFrameworks() {
  return (
    <div className="site-home-frameworks-wrapper" aria-hidden>
      <div className="site-home-frameworks">
        <ReactLogo />
        <WebpackLogo />
        <ViteLogo />
        <RspackLogo />
        <RemixLogo />
        <NextLogo />
      </div>
    </div>
  );
}

function ReactLogo() {
  return (
    <span className="site-home-fw-item site-home-fw-react">
      <svg viewBox="-10.5 -9.45 21 18.9" fill="none" aria-hidden>
        <circle cx="0" cy="0" r="2" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="1" fill="none">
          <ellipse rx="10" ry="4.5" />
          <ellipse rx="10" ry="4.5" transform="rotate(60)" />
          <ellipse rx="10" ry="4.5" transform="rotate(120)" />
        </g>
      </svg>
    </span>
  );
}

function WebpackLogo() {
  return (
    <span className="site-home-fw-item site-home-fw-webpack">
      <svg viewBox="0 0 790 876" aria-hidden>
        <path
          d="m704.9 641.7-305.1 172.6v-134.4l190.1-104.6zm20.9-18.9v-360.9l-111.6 64.5v232zm-657.9 18.9 305.1 172.6v-134.4l-190.2-104.6zm-20.9-18.9v-360.9l111.6 64.5v232zm13.1-384.3 312.9-177v129.9l-200.5 110.3-1.6.9zm652.6 0-312.9-177v129.9l200.5 110.2 1.6.9z"
          fill="#8ed6fb"
        />
        <path
          d="m373 649.3-187.6-103.2v-204.3l187.6 108.3zm26.8 0 187.6-103.1v-204.4l-187.6 108.3zm-201.7-331.1 188.3-103.5 188.3 103.5-188.3 108.7z"
          fill="#1c78c0"
        />
      </svg>
    </span>
  );
}

function ViteLogo() {
  return (
    <span className="site-home-fw-item site-home-fw-vite">
      <svg viewBox="0 0 410 404" fill="none" aria-hidden>
        <path
          d="M399.641 59.5246L215.643 388.545C211.844 395.338 202.084 395.378 198.228 388.618L10.5817 59.5563C6.38087 52.1896 12.6802 43.2665 21.0281 44.7586L205.223 77.6824C206.398 77.8924 207.601 77.8904 208.776 77.6763L389.119 44.8058C397.439 43.2894 403.768 52.1434 399.641 59.5246Z"
          fill="url(#hp-vite-a)"
        />
        <path
          d="M292.965 1.5744L156.801 28.2552C154.563 28.6937 152.906 30.5903 152.771 32.8664L144.395 174.33C144.198 177.662 147.258 180.248 150.51 179.498L188.42 170.749C191.967 169.931 195.172 173.055 194.443 176.622L183.18 231.775C182.422 235.487 185.907 238.661 189.532 237.56L212.947 230.446C216.577 229.344 220.065 232.527 219.297 236.242L201.398 322.875C200.278 328.294 207.486 331.249 210.492 326.603L212.5 323.5L323.454 102.072C325.312 98.3645 322.108 94.137 318.036 94.9228L279.014 102.454C275.347 103.161 272.227 99.746 273.262 96.1583L298.731 7.86689C299.767 4.27314 296.636 0.855181 292.965 1.5744Z"
          fill="url(#hp-vite-b)"
        />
        <defs>
          <linearGradient id="hp-vite-a" x1="6" y1="33" x2="235" y2="344" gradientUnits="userSpaceOnUse">
            <stop stopColor="#41D1FF" />
            <stop offset="1" stopColor="#BD34FE" />
          </linearGradient>
          <linearGradient
            id="hp-vite-b"
            x1="194.651"
            y1="8.818"
            x2="236.076"
            y2="292.989"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#FFEA83" />
            <stop offset="0.083" stopColor="#FFDD35" />
            <stop offset="1" stopColor="#FFA800" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}

function RspackLogo() {
  return (
    <a
      href="https://www.rspack.dev"
      aria-label="Rspack"
      target="_blank"
      rel="noreferrer"
      className="site-home-fw-item site-home-fw-rspack"
    >
      <Image src={RSPACK_LOGO} alt="" width={60} height={60} unoptimized />
    </a>
  );
}

function RemixLogo() {
  return (
    <span className="site-home-fw-item site-home-fw-remix">
      <svg viewBox="0 0 350 165" fill="none" aria-label="Remix">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M133.85 124.16C135.3 142.762 135.3 151.482 135.3 161H92.2283C92.2283 158.927 92.2653 157.03 92.3028 155.107C92.4195 149.128 92.5411 142.894 91.5717 130.304C90.2905 111.872 82.3473 107.776 67.7419 107.776H54.8021H0V74.24H69.7918C88.2407 74.24 97.4651 68.632 97.4651 53.784C97.4651 40.728 88.2407 32.816 69.7918 32.816H0V0H77.4788C119.245 0 140 19.712 140 51.2C140 74.752 125.395 90.112 105.665 92.672C122.32 96 132.057 105.472 133.85 124.16Z"
          fill="currentColor"
        />
        <path
          d="M0 161V136H45.5416C53.1486 136 54.8003 141.638 54.8003 145V161H0Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

function NextLogo() {
  return (
    <span className="site-home-fw-item site-home-fw-next">
      <svg viewBox="0 0 82 48" fill="none" aria-label="Next.js">
        <path
          d="M15.4876 14.442H27.8676V15.4282H16.6227V22.85H27.1969V23.8362H16.6227V31.9847H27.9964V32.9709H15.4876V14.442ZM28.9764 14.442H30.292L36.1209 22.5905L42.0787 14.442L50.1822 4.0918L36.8689 23.4469L43.7293 32.9709H42.3622L36.1209 24.3034L29.8538 32.9709H28.5124L35.4244 23.4469L28.9769 14.442H28.9764ZM44.2196 15.4282V14.442H58.3271V15.4282H51.828V32.9705H50.6929V15.4282H44.22H44.2196ZM0 14.442H1.41867L20.9791 43.7767L12.8956 32.9709L1.18622 15.8434L1.13467 32.9709H0V14.442Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
