"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

const LINKS = [
  { label: "YouTube Creator Academy", href: "#" },
  { label: "TikTok Community Guidelines", href: "#" },
  { label: "ElevenLabs Terms of Service", href: "#" },
  { label: "Runway ML Terms of Service", href: "#" },
  { label: "FTC Endorsement Guides", href: "#" },
];

export function AboutTab() {
  return (
    <div className="flex flex-col gap-6">
      {/* App identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ClipPilot</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">Version 0.1.0</p>
          <p className="text-sm text-muted-foreground">
            AI-powered short-form video production for YouTube Shorts, Instagram Reels, and TikTok.
          </p>
        </CardContent>
      </Card>

      {/* Legal protection summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How this app keeps you legally protected</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ClipPilot enforces a multi-layer compliance approach on every export. Every AI-generated
            video clip is screened for resemblance to real public figures before it enters the
            pipeline. Every music track is fingerprinted via AudD against Content ID databases before
            it can be used, reducing the risk of copyright strikes on YouTube and TikTok. A mandatory
            3-second &ldquo;AI Generated Content&rdquo; disclosure overlay is burned into the start of
            every export in compliance with platform policies from YouTube, TikTok, and Instagram. A
            full asset provenance PDF is generated alongside each export, documenting every asset used,
            its licence, and the results of all compliance checks — giving you a paper trail if a
            platform ever questions your content.
          </p>
        </CardContent>
      </Card>

      {/* Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform policies & resources</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3">
            {LINKS.map(({ label, href }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
                >
                  {label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
