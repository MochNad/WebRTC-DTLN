"use client";

export function HeaderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mt-8 space-y-6">
      <h1 className="text-lg font-semibold leading-tight tracking-tight md:text-2xl lg:text-3xl">
        {title}
      </h1>
      <h1 className="text-base text-muted-foreground">
        {description}
      </h1>
    </div>
  );
}
