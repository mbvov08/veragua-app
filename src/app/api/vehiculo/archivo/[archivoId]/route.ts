import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPrivateVehiculoBlob } from "@/lib/vehiculo/blob";

export async function GET(req: NextRequest, { params }: { params: Promise<{ archivoId: string }> }) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "EMPLEADA", "CONDUCTOR"].includes(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { archivoId } = await params;
  const archivo = await prisma.vehiculoArchivo.findUnique({
    where: { id: archivoId },
    include: { salida: { select: { conductorId: true } } },
  });
  if (!archivo) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const isStaff = session.user.role === "ADMIN" || session.user.role === "EMPLEADA";
  if (!isStaff && archivo.salida?.conductorId !== session.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const blob = await getPrivateVehiculoBlob(archivo.blobPathname);
  if (!blob) {
    return NextResponse.json({ error: "Archivo no encontrado en el almacenamiento" }, { status: 404 });
  }

  return new NextResponse(blob.stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": archivo.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
