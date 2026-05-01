import sharp from "sharp";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { slugify } from "@/lib/storage/naming";

export async function generateOutroFrame(projectId: string, projectTitle: string): Promise<string> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { projectSlug: true, name: true } });
  if (!project) throw new Error("Project not found");

  const projectSlug = project.projectSlug ?? slugify(project.name);
  const safeTitle = escapeXml(projectTitle || project.name);
  const svg = `
    <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="v" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stop-color="black" stop-opacity="0"/>
          <stop offset="68%" stop-color="black" stop-opacity="0.1"/>
          <stop offset="100%" stop-color="black" stop-opacity="0.4"/>
        </radialGradient>
      </defs>
      <rect width="1280" height="720" fill="#000000"/>
      <text x="640" y="360" fill="#ffffff" font-size="54" font-family="Arial, Helvetica, sans-serif" text-anchor="middle" dominant-baseline="middle" font-weight="700">${safeTitle}</text>
      <rect width="1280" height="720" fill="url(#v)"/>
    </svg>
  `;

  const buffer = await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
  const stored = await storage.save(`${projectSlug}/outro/outro_frame.jpg`, buffer, "image/jpeg", {
    projectId,
    generatedBy: "sharp",
    purpose: "runway_outro_frame",
  });
  return stored.path;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
