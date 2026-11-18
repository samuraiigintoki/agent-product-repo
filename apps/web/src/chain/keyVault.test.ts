import { describe, expect, it } from "vitest";
import {
  clearSealedBox,
  createKeyMaterial,
  loadSealedBox,
  openBackupCode,
  openSealedBox,
  saveSealedBox,
  sealKeyMaterial,
  toBackupCode,
  WALLET_BOX_KEY,
} from "./keyVault";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    raw: map,
  };
}

const PASSWORD = "correct horse battery";

describe("key vault", () => {
  it("seals and opens key material with the right password", async () => {
    const material = createKeyMaterial();
    const box = await sealKeyMaterial(material, PASSWORD);
    const opened = await openSealedBox(box, PASSWORD);
    expect(opened).toEqual(material);
  });

  it("makes different key material every time", () => {
    const a = createKeyMaterial();
    const b = createKeyMaterial();
    expect(a.secret).not.toBe(b.secret);
    expect(a.secret).toMatch(/^0x[0-9a-f]{64}$/);
    expect(a.signingKey).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("refuses a short password in plain words", async () => {
    const material = createKeyMaterial();
    await expect(sealKeyMaterial(material, "short")).rejects.toThrow(
      /at least 8 characters/,
    );
  });

  it("wrong password fails with one plain message", async () => {
    const box = await sealKeyMaterial(createKeyMaterial(), PASSWORD);
    await expect(openSealedBox(box, "wrong password here")).rejects.toThrow(
      /Wrong password or damaged backup/,
    );
  });

  it("one changed byte in the box fails the same way", async () => {
    const box = await sealKeyMaterial(createKeyMaterial(), PASSWORD);
    const parts = box.split(".");
    const data = parts[3];
    const flipped =
      data.slice(0, 4) + (data[4] === "A" ? "B" : "A") + data.slice(5);
    const damaged = [...parts.slice(0, 3), flipped].join(".");
    await expect(openSealedBox(damaged, PASSWORD)).rejects.toThrow(
      /Wrong password or damaged backup/,
    );
  });

  it("sealing the same material twice gives two different boxes", async () => {
    const material = createKeyMaterial();
    const one = await sealKeyMaterial(material, PASSWORD);
    const two = await sealKeyMaterial(material, PASSWORD);
    expect(one).not.toBe(two);
    expect(await openSealedBox(one, PASSWORD)).toEqual(material);
    expect(await openSealedBox(two, PASSWORD)).toEqual(material);
  });

  it("the backup code carries the same wallet through a round trip", async () => {
    const material = createKeyMaterial();
    const box = await sealKeyMaterial(material, PASSWORD);
    const code = toBackupCode(box);
    expect(code.startsWith("pp-backup.")).toBe(true);
    expect(code).not.toContain(material.secret.slice(2));
    const restored = await openBackupCode(code, PASSWORD);
    expect(restored).toEqual(material);
  });

  it("a garbled backup code fails in plain words", async () => {
    await expect(openBackupCode("pp-backup.!!!", PASSWORD)).rejects.toThrow(
      /does not look like a backup code/,
    );
    await expect(openBackupCode("hello", PASSWORD)).rejects.toThrow(
      /does not look like a backup code/,
    );
  });

  it("storage holds only the sealed box, never the plain keys", async () => {
    const storage = memoryStorage();
    const material = createKeyMaterial();
    const box = await sealKeyMaterial(material, PASSWORD);
    saveSealedBox(storage, box);
    const stored = storage.raw.get(WALLET_BOX_KEY) ?? "";
    expect(stored).toBe(box);
    expect(stored).not.toContain(material.secret.slice(2));
    expect(stored).not.toContain(material.signingKey.slice(2));
    expect(loadSealedBox(storage)).toBe(box);
    clearSealedBox(storage);
    expect(loadSealedBox(storage)).toBeNull();
  });
});
