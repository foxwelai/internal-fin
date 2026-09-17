import Image from "next/image";
import Link from "next/link";

/** The branded frame around Clerk's sign-in and sign-up forms. */
export function AuthShell({
  title,
  subtitle,
  children,
  switchPrompt,
  switchHref,
  switchLabel,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  switchPrompt: string;
  switchHref: string;
  switchLabel: string;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35]" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(244,85,29,0.16),transparent_65%)] blur-2xl"
      />

      <div className="relative flex w-full max-w-[400px] flex-col items-center">
        <Image
          src="/logo-lockup.png"
          alt="foxwel.ai"
          width={200}
          height={159}
          priority
          className="h-16 w-auto"
        />
        <h1 className="mt-5 text-lg font-semibold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-center text-[13px] leading-relaxed text-muted-foreground">
          {subtitle}
        </p>

        <div className="mt-6 w-full [&_.cl-rootBox]:w-full [&_.cl-cardBox]:w-full">{children}</div>

        <p className="mt-5 text-[13px] text-muted-foreground">
          {switchPrompt}{" "}
          <Link href={switchHref} className="font-medium text-brand hover:underline">
            {switchLabel}
          </Link>
        </p>
      </div>
    </main>
  );
}
