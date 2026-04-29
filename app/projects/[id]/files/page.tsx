import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { getProjectFileTree, type FileTreeNode } from "@/lib/storage/file-tree";
import { slugify } from "@/lib/storage/naming";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { FileTreeBrowser, type BrowserNode } from "./_components/file-tree-browser";

export default async function ProjectFilesPage({ params }: { params: { id: string } }) {
  const project = await db.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();

  const projectSlug = project.projectSlug ?? slugify(project.name);
  if (!project.storageFolderInitialized) {
    await storage.initProjectFolders(projectSlug, project.name);
    await db.project.update({
      where: { id: project.id },
      data: { projectSlug, storageFolderInitialized: true },
    });
  }

  const tree = await getProjectFileTree(projectSlug);
  const browserTree = await addUrls(tree);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${project.id}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-sm text-muted-foreground">Project files and generated media</p>
        </div>
      </div>
      <FileTreeBrowser tree={browserTree} projectSlug={projectSlug} />
    </div>
  );
}

async function addUrls(node: FileTreeNode): Promise<BrowserNode> {
  return {
    ...node,
    url: node.type === "file" ? await storage.getUrl(node.path) : undefined,
    children: node.children ? await Promise.all(node.children.map(addUrls)) : undefined,
  };
}
