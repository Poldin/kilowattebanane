import { Head } from "react-email";

const BANANA = "#F5D547";

export function MailHeadStyles() {
  return (
    <Head>
      <meta name="color-scheme" content="light dark" />
      <meta name="supported-color-schemes" content="light dark" />
      <style>{`
        .banana-bg,
        .banana-bg > table,
        .banana-bg > table > tbody > tr > td {
          background-color: ${BANANA} !important;
          background-image: linear-gradient(${BANANA}, ${BANANA}) !important;
        }
        .banana-title,
        .banana-sub {
          color: #111111 !important;
        }
        .banana-sub {
          color: #262626 !important;
        }
        @media (prefers-color-scheme: dark) {
          .banana-bg,
          .banana-bg > table,
          .banana-bg > table > tbody > tr > td {
            background-color: ${BANANA} !important;
            background-image: linear-gradient(${BANANA}, ${BANANA}) !important;
          }
          .banana-title,
          .banana-sub {
            color: #111111 !important;
          }
          .banana-sub {
            color: #262626 !important;
          }
        }
        u + .body .banana-bg,
        u + .body .banana-bg > table,
        u + .body .banana-bg > table > tbody > tr > td {
          background-color: ${BANANA} !important;
          background-image: linear-gradient(${BANANA}, ${BANANA}) !important;
        }
        u + .body .banana-title {
          color: #111111 !important;
        }
        u + .body .banana-sub {
          color: #262626 !important;
        }
      `}</style>
    </Head>
  );
}
