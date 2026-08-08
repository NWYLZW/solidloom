export const MAX_SKIN_FILE_BYTES = 256 * 1024;

export function readVoxelSkinFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("read"));
        return;
      }
      const image = new Image();
      image.onerror = () => reject(new Error("dimensions"));
      image.onload = () => image.naturalWidth === 64 && image.naturalHeight === 64
        ? resolve(reader.result as string)
        : reject(new Error("dimensions"));
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
