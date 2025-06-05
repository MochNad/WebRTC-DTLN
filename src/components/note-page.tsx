"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NotePage({
  title,
  content,
}: {
  title: string;
  content: ReadonlyArray<{ readonly title: string; readonly description: string }>
}) {
  return (
    <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-base text-amber-800 dark:text-amber-300">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <ul className="space-y-2">
          {content.map((item, index) => (
            <li key={index} className="border-b border-amber-100 dark:border-amber-800/50 pb-2 last:border-b-0">
              <div className="flex justify-between items-start">
                <h3 className="font-medium text-sm text-amber-900 dark:text-amber-200 w-1/2">{item.title}</h3>
                <p className="text-xs text-amber-700 dark:text-amber-400 w-1/2">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
