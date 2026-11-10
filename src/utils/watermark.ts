/**
 * Utility to apply the official R.Alves Concursos branding:
 * - TOPO: Logo oficial centralizada em alta definição.
 * - CENTRO: Mapa mental ilustrado intacto (sem cortes).
 * - RODAPÉ: Informações oficiais de contato (@R.Alvesconcursos, WhatsApp e Site).
 */
export async function addWatermarkToImage(
  sourceImageUrl: string,
  title?: string
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = async () => {
      try {
        // Banner superior para a logo oficial centralizada
        const topHeaderHeight = Math.max(72, Math.round(img.height * 0.10));
        // Banner inferior para contatos oficiais
        const footerHeight = Math.max(54, Math.round(img.height * 0.075));
        
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height + topHeaderHeight + footerHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(sourceImageUrl);
          return;
        }

        // Fundo geral branco elegante
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 1. Desenhar a imagem gerada pelo modelo no centro (abaixo do topo)
        ctx.drawImage(img, 0, topHeaderHeight);

        // Helper para carregar imagens com fallback
        const loadFirstWorkingImage = async (urls: string[]): Promise<HTMLImageElement | null> => {
          for (const url of urls) {
            try {
              const img = await new Promise<HTMLImageElement | null>((res) => {
                const i = new Image();
                i.crossOrigin = "anonymous";
                i.onload = () => res(i);
                i.onerror = () => res(null);
                i.src = url;
              });
              if (img && img.width > 0) return img;
            } catch {
              // Próxima URL
            }
          }
          return null;
        };

        const whatsappSvgDataUri = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500"><circle cx="250" cy="250" r="250" fill="%2325D366"/><path fill="%23FFF" d="M362.9 135.7C332.8 105.6 292.8 89 250.3 89c-88.8 0-161.1 72.3-161.1 161.1 0 28.4 7.4 56.1 21.5 80.5L89 411l80.2-21c23.6 12.9 50.2 19.7 77.2 19.7h.1c88.8 0 161.1-72.3 161.1-161.1 0-42.5-16.5-82.5-46.7-112.9zM250.3 381.7c-24.1 0-47.7-6.5-68.3-18.7l-4.9-2.9-50.7 13.3 13.5-49.4-3.2-5.1c-13.4-21.3-20.5-46.1-20.5-71.5 0-73.2 59.6-132.8 132.8-132.8 35.5 0 68.8 13.8 93.9 38.9 25.1 25.1 38.9 58.4 38.9 93.9 0 73.2-59.6 132.8-132.8 132.8zm72.8-99.3c-4-2-23.6-11.6-27.3-13-3.7-1.3-6.4-2-9.1 2s-10.5 13-12.9 15.7c-2.4 2.7-4.8 3-8.8 1s-16.9-6.2-32.2-19.8c-11.9-10.6-20-23.7-22.3-27.7s-.2-6.2 1.8-8.2c1.8-1.8 4-4.7 6-7s2.7-4 4-6.7c1.3-2.7.7-5-0.3-7s-9.1-22-12.5-30.1c-3.3-7.9-6.7-6.8-9.1-6.9-2.4-.1-5.1-.1-7.8-.1s-7.1 1-10.8 5c-3.7 4-14.2 13.9-14.2 33.9s14.5 39.3 16.5 42c2 2.7 28.5 43.5 69.1 61 9.7 4.2 17.2 6.7 23.1 8.6 9.7 3.1 18.6 2.7 25.6 1.6 7.8-1.2 23.6-9.6 26.9-18.9 3.3-9.3 3.3-17.3 2.3-18.9-1-1.6-3.7-2.6-7.7-4.6z"/></svg>`;
        const instagramSvgDataUri = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><radialGradient id="ig" cx="0.3" cy="1.0" r="1.2"><stop offset="0%25" stop-color="%23fed576"/><stop offset="26%25" stop-color="%23f47133"/><stop offset="60%25" stop-color="%23bc3081"/><stop offset="100%25" stop-color="%234c63d2"/></radialGradient></defs><rect width="512" height="512" rx="115" fill="url(%23ig)"/><path fill="%23fff" d="M256 120c-73.9 0-136 62.1-136 136s62.1 136 136 136 136-62.1 136-136-62.1-136-136-136zm0 224c-48.5 0-88-39.5-88-88s39.5-88 88-88 88 39.5 88 88-39.5 88-88 88zm129.6-225.8c0 17.4-14.1 31.5-31.5 31.5-17.4 0-31.5-14.1-31.5-31.5s14.1-31.5 31.5-31.5c17.4 0 31.5 14.1 31.5 31.5z"/></svg>`;

        // Carregar a logo oficial informada e ícones de contato
        const [logoImg, waImg, instaImg] = await Promise.all([
          loadFirstWorkingImage([
            "https://i.postimg.cc/jd4s3cNj/Whats-App-Image-2026-07-16-at-13-37-03-1-removebg-preview-(1).png",
            "https://i.ibb.co/mrvgPLKT/Whats-App-Image-2026-07-16-at-13-37-03-1-removebg-preview.png"
          ]),
          loadFirstWorkingImage([
            "https://png.pngtree.com/png-vector/20221018/ourmid/pngtree-whatsapp-icon-new-png-image_6315990.png",
            "https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg",
            whatsappSvgDataUri
          ]),
          loadFirstWorkingImage([
            "https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg",
            instagramSvgDataUri
          ])
        ]);

        ctx.save();

        // -------------------------------------------------------------
        // A) TOPO: LOGO OFICIAL R.ALVES CONCURSOS CENTRALIZADA
        // -------------------------------------------------------------
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, topHeaderHeight);

        // Linha sutil inferior no cabeçalho
        ctx.fillStyle = "#E2E8F0";
        ctx.fillRect(0, topHeaderHeight - 1, canvas.width, 1);

        if (logoImg && logoImg.width > 0) {
          const targetLogoH = Math.round(topHeaderHeight * 0.82);
          const targetLogoW = Math.round((logoImg.width / logoImg.height) * targetLogoH);
          const logoX = Math.round((canvas.width - targetLogoW) / 2);
          const logoY = Math.round((topHeaderHeight - targetLogoH) / 2);
          ctx.drawImage(logoImg, logoX, logoY, targetLogoW, targetLogoH);
        } else {
          // Fallback tipográfico caso a imagem da logo falhe na rede
          ctx.fillStyle = "#155441";
          ctx.font = `bold ${Math.round(topHeaderHeight * 0.40)}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("R.ALVES CONCURSOS", canvas.width / 2, topHeaderHeight / 2);
        }

        // -------------------------------------------------------------
        // B) RODAPÉ: CONTATOS OFICIAIS CENTRALIZADOS
        // -------------------------------------------------------------
        const footerY = topHeaderHeight + img.height;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, footerY, canvas.width, footerHeight);

        // Barra sutil verde esmeralda no topo do rodapé
        ctx.fillStyle = "#10B981";
        ctx.fillRect(0, footerY, canvas.width, Math.max(3, Math.round(footerHeight * 0.05)));

        ctx.fillStyle = "#E2E8F0";
        ctx.fillRect(0, footerY + Math.max(3, Math.round(footerHeight * 0.05)), canvas.width, 1);

        const fontSize = Math.max(12, Math.round(footerHeight * 0.28));
        ctx.font = `600 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        const iconSize = Math.max(16, Math.round(footerHeight * 0.44));
        const centerY = footerY + footerHeight / 2 + 2;

        const instaText = "Instagram: @R.Alvesconcursos";
        const waText = "WhatsApp: 77 99840-1073";
        const siteText = "Site: ralvesconcursos.com.br";

        const gap = Math.max(20, Math.round(canvas.width * 0.025));
        const totalBlockWidth =
          (iconSize + 6 + ctx.measureText(instaText).width) +
          gap +
          (iconSize + 6 + ctx.measureText(waText).width) +
          gap +
          (iconSize + 6 + ctx.measureText(siteText).width);

        // Centralizar os contatos no rodapé
        let curX = Math.max(16, Math.round((canvas.width - totalBlockWidth) / 2));

        // 1. Instagram
        if (instaImg && instaImg.width > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(curX + iconSize / 2, centerY, iconSize / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(instaImg, curX, centerY - iconSize / 2, iconSize, iconSize);
          ctx.restore();
          curX += iconSize + 6;
        } else {
          ctx.fillText("📸", curX, centerY);
          curX += fontSize * 1.2;
        }
        ctx.fillStyle = "#0F172A";
        ctx.fillText(instaText, curX, centerY);
        curX += ctx.measureText(instaText).width + gap;

        // 2. WhatsApp
        if (waImg && waImg.width > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(curX + iconSize / 2, centerY, iconSize / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(waImg, curX, centerY - iconSize / 2, iconSize, iconSize);
          ctx.restore();
          curX += iconSize + 6;
        } else {
          ctx.fillText("💬", curX, centerY);
          curX += fontSize * 1.2;
        }
        ctx.fillStyle = "#0F172A";
        ctx.fillText(waText, curX, centerY);
        curX += ctx.measureText(waText).width + gap;

        // 3. Site
        ctx.fillStyle = "#059669";
        ctx.fillText("🌐", curX, centerY);
        curX += fontSize * 1.2;
        ctx.fillText(siteText, curX, centerY);

        ctx.restore();

        try {
          resolve(canvas.toDataURL("image/png"));
        } catch (e) {
          console.error("Canvas export failed:", e);
          resolve(sourceImageUrl);
        }
      } catch (err) {
        console.error("Watermark generation error:", err);
        resolve(sourceImageUrl);
      }
    };

    img.onerror = () => resolve(sourceImageUrl);
    img.src = sourceImageUrl;
  });
}

/**
 * Compresses an image to high-clarity JPEG format (max width 1200px, quality 0.78)
 * so that base64 string stays under ~500KB (Firestore 1MB limit).
 */
export async function compressImageForStorage(
  sourceImageUrl: string,
  maxWidth = 1200,
  quality = 0.78
): Promise<string> {
  if (sourceImageUrl.startsWith('http://') || sourceImageUrl.startsWith('https://')) {
    if (sourceImageUrl.length < 500) {
      return sourceImageUrl;
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(sourceImageUrl);
          return;
        }

        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      } catch (err) {
        console.warn("Image compression failed, returning original:", err);
        resolve(sourceImageUrl);
      }
    };

    img.onerror = () => {
      resolve(sourceImageUrl);
    };

    img.src = sourceImageUrl;
  });
}

