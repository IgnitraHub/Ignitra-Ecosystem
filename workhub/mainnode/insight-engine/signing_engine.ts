export class SigningEngine {
  private keyPair?: CryptoKeyPair

  constructor() {
    // defer key generation to async init
  }

  /**
   * Initialize the engine with a fresh RSA keypair
   */
  async init(): Promise<void> {
    this.keyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"]
    ) as CryptoKeyPair
  }

  private ensureKeys(): asserts this is { keyPair: CryptoKeyPair } {
    if (!this.keyPair) throw new Error("SigningEngine not initialized. Call init() first.")
  }

  async sign(data: string): Promise<string> {
    this.ensureKeys()
    const enc = new TextEncoder().encode(data)
    const sig = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      this.keyPair.privateKey,
      enc
    )
    return Buffer.from(sig).toString("base64")
  }

  async verify(data: string, signature: string): Promise<boolean> {
    this.ensureKeys()
    const enc = new TextEncoder().encode(data)
    const sig = Buffer.from(signature, "base64")
    return crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      this.keyPair.publicKey,
      sig,
      enc
    )
  }

  async exportPublicKey(): Promise<string> {
    this.ensureKeys()
    const spki = await crypto.subtle.exportKey("spki", this.keyPair.publicKey)
    return Buffer.from(spki).toString("base64")
  }

  async exportPrivateKey(): Promise<string> {
    this.ensureKeys()
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", this.keyPair.privateKey)
    return Buffer.from(pkcs8).toString("base64")
  }
}
