(() => {
  "use strict";

  const { PDFDocument, rgb } = PDFLib;

  const elements = {
    dropZone: document.querySelector("#dropZone"),
    fileInput: document.querySelector("#fileInput"),
    workspace: document.querySelector("#workspace"),
    imageGrid: document.querySelector("#imageGrid"),
    addMoreButton: document.querySelector("#addMoreButton"),
    clearButton: document.querySelector("#clearButton"),
    createPdfButton: document.querySelector("#createPdfButton"),
    fileName: document.querySelector("#fileName"),
    pageSize: document.querySelector("#pageSize"),
    orientation: document.querySelector("#orientation"),
    margin: document.querySelector("#margin"),
    compressionPreset: document.querySelector("#compressionPreset"),
    maxDimension: document.querySelector("#maxDimension"),
    quality: document.querySelector("#quality"),
    qualityOutput: document.querySelector("#qualityOutput"),
    estimateSizeButton: document.querySelector("#estimateSizeButton"),
    sizeEstimate: document.querySelector("#sizeEstimate"),
    whiteBackground: document.querySelector("#whiteBackground"),
    status: document.querySelector("#status"),
    cardTemplate: document.querySelector("#imageCardTemplate"),
    editorDialog: document.querySelector("#editorDialog"),
    editorCanvas: document.querySelector("#editorCanvas"),
    editorFileName: document.querySelector("#editorFileName"),
    closeEditorButton: document.querySelector("#closeEditorButton"),
    cancelEditButton: document.querySelector("#cancelEditButton"),
    applyEditButton: document.querySelector("#applyEditButton"),
    resetButton: document.querySelector("#resetButton"),
    rotateLeftButton: document.querySelector("#rotateLeftButton"),
    rotateRightButton: document.querySelector("#rotateRightButton"),
    brightness: document.querySelector("#brightness"),
    brightnessOutput: document.querySelector("#brightnessOutput"),
    contrast: document.querySelector("#contrast"),
    contrastOutput: document.querySelector("#contrastOutput"),
    grayscale: document.querySelector("#grayscale"),
    blackWhite: document.querySelector("#blackWhite"),
    thresholdField: document.querySelector("#thresholdField"),
    threshold: document.querySelector("#threshold"),
    thresholdOutput: document.querySelector("#thresholdOutput"),
  };

  const state = {
    items: [],
    editingId: null,
    temporaryEdit: null,
    dragId: null,
  };

  const DEFAULT_EDIT = Object.freeze({
    rotation: 0,
    brightness: 100,
    contrast: 100,
    grayscale: false,
    blackWhite: false,
    threshold: 160,
  });

  const PAGE_SIZES = {
    a4: [595.28, 841.89],
    letter: [612, 792],
  };

  const COMPRESSION_PRESETS = {
    small: { maxDimension: 1200, quality: 60 },
    balanced: { maxDimension: 1800, quality: 75 },
    high: { maxDimension: 2400, quality: 85 },
    original: { maxDimension: 0, quality: 90 },
  };

  const SUPPORTED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/bmp",
    "image/gif",
  ]);

  function getCompressionSettings() {
    return {
      maxDimension: Number(elements.maxDimension.value),
      quality: Number(elements.quality.value) / 100,
    };
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function applyCompressionPreset() {
    const preset = COMPRESSION_PRESETS[elements.compressionPreset.value];
    elements.maxDimension.value = String(preset.maxDimension);
    elements.quality.value = String(preset.quality);
    elements.qualityOutput.value = `${preset.quality}%`;
    elements.sizeEstimate.textContent = "Estimated size: —";
  }

  async function estimatePdfSize() {
    if (!state.items.length) {
      setStatus("Add at least one PDF or image first.", "error");
      return;
    }

    elements.estimateSizeButton.disabled = true;
    const { maxDimension, quality } = getCompressionSettings();
    let totalBytes = 0;

    try {
      let outputPageCount = 0;

      for (let index = 0; index < state.items.length; index += 1) {
        elements.sizeEstimate.textContent = `Estimating ${index + 1} of ${state.items.length}…`;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const item = state.items[index];

        if (item.type === "pdf") {
          totalBytes += item.file.size;
          outputPageCount += item.pageCount;
          continue;
        }

        const imageItem = item;
        const canvas = renderEditedImageToCanvas(imageItem, imageItem.edit, {
          maxWidth: maxDimension || null,
          maxHeight: maxDimension || null,
          maxPixels: maxDimension ? maxDimension * maxDimension : 18_000_000,
          whiteBackground: elements.whiteBackground.checked,
        });
        const blob = await canvasToBlob(canvas, "image/jpeg", quality);
        totalBytes += blob.size;
        outputPageCount += 1;
      }

      // Add a small allowance for PDF page objects and metadata.
      totalBytes += outputPageCount * 2500 + 5000;
      elements.sizeEstimate.textContent = `Estimated size: about ${formatBytes(totalBytes)}`;
    } catch (error) {
      console.error(error);
      elements.sizeEstimate.textContent = "Estimated size: unavailable";
    } finally {
      elements.estimateSizeButton.disabled = false;
    }
  }

  function uniqueId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function setStatus(message, type = "") {
    elements.status.textContent = message;
    elements.status.className = `status ${type}`.trim();
  }

  function normalizePdfFileName(value) {
    const clean = value.trim() || "merged.pdf";
    return clean.toLowerCase().endsWith(".pdf") ? clean : `${clean}.pdf`;
  }

  function isSupportedImage(file) {
    return (
      SUPPORTED_IMAGE_TYPES.has(file.type.toLowerCase()) ||
      /\.(jpe?g|png|webp|bmp|gif)$/i.test(file.name)
    );
  }

  function isPdfFile(file) {
    return file.type.toLowerCase() === "application/pdf" || /\.pdf$/i.test(file.name);
  }

  function isSupportedFile(file) {
    return isPdfFile(file) || isSupportedImage(file);
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Could not read ${file.name}.`));
      };

      image.src = objectUrl;
    });
  }

  async function addFiles(fileList) {
    const selectedFiles = Array.from(fileList);
    const files = selectedFiles.filter(isSupportedFile);

    if (!files.length) {
      setStatus("Please choose supported PDF or image files.", "error");
      return;
    }

    setStatus(`Loading ${files.length} file${files.length === 1 ? "" : "s"}…`);
    elements.addMoreButton.disabled = true;

    const failures = selectedFiles
      .filter((file) => !isSupportedFile(file))
      .map((file) => file.name);

    for (const file of files) {
      try {
        if (isPdfFile(file)) {
          const pdfBytes = new Uint8Array(await file.arrayBuffer());
          const pdf = await PDFDocument.load(pdfBytes, { updateMetadata: false });
          const pageCount = pdf.getPageCount();

          if (!pageCount) {
            throw new Error(`${file.name} does not contain any pages.`);
          }

          state.items.push({
            id: uniqueId(),
            type: "pdf",
            file,
            pdfBytes,
            pageCount,
          });
          continue;
        }

        const image = await loadImageFromFile(file);

        state.items.push({
          id: uniqueId(),
          type: "image",
          file,
          image,
          width: image.naturalWidth,
          height: image.naturalHeight,
          edit: { ...DEFAULT_EDIT },
        });
      } catch (error) {
        failures.push(file.name);
        console.error(error);
      }
    }

    elements.addMoreButton.disabled = false;
    elements.fileInput.value = "";
    renderImageList();

    if (failures.length) {
      setStatus(`Could not load: ${failures.join(", ")}`, "error");
    } else {
      setStatus(`${files.length} file${files.length === 1 ? "" : "s"} added.`, "success");
    }
  }

  function getRotatedDimensions(imageItem, edit = imageItem.edit) {
    const normalized = ((edit.rotation % 360) + 360) % 360;
    const swap = normalized === 90 || normalized === 270;

    return {
      width: swap ? imageItem.height : imageItem.width,
      height: swap ? imageItem.width : imageItem.height,
    };
  }

  function getSafeCanvasSize(width, height, maxPixels = 18_000_000) {
    const pixels = width * height;

    if (pixels <= maxPixels) {
      return { width, height, scale: 1 };
    }

    const scale = Math.sqrt(maxPixels / pixels);

    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
      scale,
    };
  }

  function renderEditedImageToCanvas(imageItem, edit, options = {}) {
    const {
      maxWidth = null,
      maxHeight = null,
      maxPixels = 18_000_000,
      whiteBackground = true,
    } = options;

    const rotated = getRotatedDimensions(imageItem, edit);
    let scale = 1;

    if (maxWidth || maxHeight) {
      const widthScale = maxWidth ? maxWidth / rotated.width : Infinity;
      const heightScale = maxHeight ? maxHeight / rotated.height : Infinity;
      scale = Math.min(1, widthScale, heightScale);
    }

    let targetWidth = Math.max(1, Math.round(rotated.width * scale));
    let targetHeight = Math.max(1, Math.round(rotated.height * scale));
    const safe = getSafeCanvasSize(targetWidth, targetHeight, maxPixels);
    targetWidth = safe.width;
    targetHeight = safe.height;

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d", { willReadFrequently: edit.blackWhite });

    if (!context) {
      throw new Error("Canvas is not supported by this browser.");
    }

    if (whiteBackground) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.save();
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((edit.rotation * Math.PI) / 180);

    const rotationNormalized = ((edit.rotation % 360) + 360) % 360;
    const baseScale =
      rotationNormalized === 90 || rotationNormalized === 270
        ? canvas.height / imageItem.width
        : canvas.width / imageItem.width;

    const drawWidth = imageItem.width * baseScale;
    const drawHeight = imageItem.height * baseScale;

    context.filter = [
      `brightness(${edit.brightness}%)`,
      `contrast(${edit.contrast}%)`,
      edit.grayscale || edit.blackWhite ? "grayscale(100%)" : "grayscale(0%)",
    ].join(" ");

    context.drawImage(
      imageItem.image,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight,
    );
    context.restore();
    context.filter = "none";

    if (edit.blackWhite) {
      applyThreshold(context, canvas.width, canvas.height, edit.threshold);
    }

    return canvas;
  }

  function applyThreshold(context, width, height, threshold) {
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let index = 0; index < data.length; index += 4) {
      const luminance =
        0.2126 * data[index] +
        0.7152 * data[index + 1] +
        0.0722 * data[index + 2];

      const value = luminance >= threshold ? 255 : 0;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
    }

    context.putImageData(imageData, 0, 0);
  }

  function drawThumbnail(canvas, imageItem) {
    const rendered = renderEditedImageToCanvas(imageItem, imageItem.edit, {
      maxWidth: 240,
      maxHeight: 180,
      maxPixels: 300_000,
      whiteBackground: true,
    });

    canvas.width = rendered.width;
    canvas.height = rendered.height;

    const context = canvas.getContext("2d");
    context.drawImage(rendered, 0, 0);
  }

  function drawPdfThumbnail(canvas, pageCount) {
    canvas.classList.add("pdf-thumbnail");
    canvas.width = 180;
    canvas.height = 148;
    const context = canvas.getContext("2d");

    context.fillStyle = "#f8fafc";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#d92d20";
    context.fillRect(45, 24, 90, 72);
    context.fillStyle = "#ffffff";
    context.font = "700 28px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("PDF", 90, 60);
    context.fillStyle = "#475467";
    context.font = "600 18px system-ui, sans-serif";
    context.fillText(`${pageCount} page${pageCount === 1 ? "" : "s"}`, 90, 119);
  }

  function renderImageList() {
    elements.imageGrid.innerHTML = "";
    elements.sizeEstimate.textContent = "Estimated size: —";
    elements.workspace.classList.toggle("hidden", state.items.length === 0);
    elements.dropZone.closest(".upload-panel").classList.toggle("hidden", state.items.length > 0);

    state.items.forEach((item, index) => {
      const fragment = elements.cardTemplate.content.cloneNode(true);
      const card = fragment.querySelector(".image-card");
      const number = fragment.querySelector(".image-number");
      const thumbnail = fragment.querySelector(".thumbnail");
      const name = fragment.querySelector(".card-name");
      const dimensions = fragment.querySelector(".card-dimensions");
      const editButton = fragment.querySelector(".edit-button");
      const removeButton = fragment.querySelector(".remove-button");

      card.dataset.id = item.id;
      number.textContent = index + 1;
      name.textContent = item.file.name;
      name.title = item.file.name;

      if (item.type === "pdf") {
        dimensions.textContent = `${item.pageCount} PDF page${item.pageCount === 1 ? "" : "s"} · original quality`;
        editButton.remove();
        drawPdfThumbnail(thumbnail, item.pageCount);
      } else {
        const rotated = getRotatedDimensions(item);
        dimensions.textContent = `${rotated.width} × ${rotated.height}px · image`;
        drawThumbnail(thumbnail, item);
        editButton.addEventListener("click", () => openEditor(item.id));
      }

      removeButton.addEventListener("click", () => removeImage(item.id));

      card.addEventListener("dragstart", handleDragStart);
      card.addEventListener("dragover", handleDragOver);
      card.addEventListener("dragleave", handleDragLeave);
      card.addEventListener("drop", handleDrop);
      card.addEventListener("dragend", handleDragEnd);

      elements.imageGrid.appendChild(fragment);
    });
  }

  function removeImage(id) {
    state.items = state.items.filter((item) => item.id !== id);
    renderImageList();
    setStatus(state.items.length ? "File removed." : "");
  }

  function clearAll() {
    state.items = [];
    renderImageList();
    setStatus("");
  }

  function handleDragStart(event) {
    state.dragId = event.currentTarget.dataset.id;
    event.currentTarget.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", state.dragId);
  }

  function handleDragOver(event) {
    event.preventDefault();
    const card = event.currentTarget;

    if (card.dataset.id !== state.dragId) {
      card.classList.add("drag-target");
    }

    event.dataTransfer.dropEffect = "move";
  }

  function handleDragLeave(event) {
    event.currentTarget.classList.remove("drag-target");
  }

  function handleDrop(event) {
    event.preventDefault();
    const targetId = event.currentTarget.dataset.id;
    const sourceId = state.dragId || event.dataTransfer.getData("text/plain");

    if (!sourceId || sourceId === targetId) {
      return;
    }

    const sourceIndex = state.items.findIndex((item) => item.id === sourceId);
    const targetIndex = state.items.findIndex((item) => item.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) {
      return;
    }

    const [moved] = state.items.splice(sourceIndex, 1);
    state.items.splice(targetIndex, 0, moved);
    renderImageList();
    setStatus("File order updated.", "success");
  }

  function handleDragEnd() {
    state.dragId = null;
    document.querySelectorAll(".image-card").forEach((card) => {
      card.classList.remove("dragging", "drag-target");
    });
  }

  function openEditor(id) {
    const imageItem = state.items.find((item) => item.id === id && item.type === "image");

    if (!imageItem) {
      return;
    }

    state.editingId = id;
    state.temporaryEdit = { ...imageItem.edit };
    elements.editorFileName.textContent = imageItem.file.name;
    syncEditorControls();
    renderEditorPreview();
    elements.editorDialog.showModal();
  }

  function closeEditor() {
    state.editingId = null;
    state.temporaryEdit = null;

    if (elements.editorDialog.open) {
      elements.editorDialog.close();
    }
  }

  function syncEditorControls() {
    const edit = state.temporaryEdit;

    elements.brightness.value = edit.brightness;
    elements.brightnessOutput.value = `${edit.brightness}%`;
    elements.contrast.value = edit.contrast;
    elements.contrastOutput.value = `${edit.contrast}%`;
    elements.grayscale.checked = edit.grayscale;
    elements.blackWhite.checked = edit.blackWhite;
    elements.threshold.value = edit.threshold;
    elements.thresholdOutput.value = edit.threshold;
    elements.thresholdField.classList.toggle("hidden", !edit.blackWhite);
  }

  function updateTemporaryEditFromControls() {
    const edit = state.temporaryEdit;

    edit.brightness = Number(elements.brightness.value);
    edit.contrast = Number(elements.contrast.value);
    edit.grayscale = elements.grayscale.checked;
    edit.blackWhite = elements.blackWhite.checked;
    edit.threshold = Number(elements.threshold.value);

    elements.brightnessOutput.value = `${edit.brightness}%`;
    elements.contrastOutput.value = `${edit.contrast}%`;
    elements.thresholdOutput.value = edit.threshold;
    elements.thresholdField.classList.toggle("hidden", !edit.blackWhite);
  }

  function renderEditorPreview() {
    const imageItem = state.items.find(
      (item) => item.id === state.editingId && item.type === "image",
    );

    if (!imageItem || !state.temporaryEdit) {
      return;
    }

    const rendered = renderEditedImageToCanvas(imageItem, state.temporaryEdit, {
      maxWidth: 1200,
      maxHeight: 900,
      maxPixels: 2_500_000,
      whiteBackground: true,
    });

    elements.editorCanvas.width = rendered.width;
    elements.editorCanvas.height = rendered.height;
    const context = elements.editorCanvas.getContext("2d");
    context.drawImage(rendered, 0, 0);
  }

  function rotateTemporary(amount) {
    state.temporaryEdit.rotation =
      (state.temporaryEdit.rotation + amount + 360) % 360;
    renderEditorPreview();
  }

  function resetTemporaryEdit() {
    state.temporaryEdit = { ...DEFAULT_EDIT };
    syncEditorControls();
    renderEditorPreview();
  }

  function applyEditorChanges() {
    const imageItem = state.items.find(
      (item) => item.id === state.editingId && item.type === "image",
    );

    if (!imageItem || !state.temporaryEdit) {
      return;
    }

    imageItem.edit = { ...state.temporaryEdit };
    closeEditor();
    renderImageList();
    setStatus("Image edits applied.", "success");
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Could not encode an edited image."));
          }
        },
        type,
        quality,
      );
    });
  }

  function resolvePageDimensions(imageWidth, imageHeight) {
    const pageSize = elements.pageSize.value;
    const orientation = elements.orientation.value;

    if (pageSize === "fit") {
      const maxDimension = 1440;
      const scale = Math.min(1, maxDimension / Math.max(imageWidth, imageHeight));
      let width = Math.max(72, imageWidth * scale);
      let height = Math.max(72, imageHeight * scale);

      if (orientation === "portrait" && width > height) {
        [width, height] = [height, width];
      } else if (orientation === "landscape" && height > width) {
        [width, height] = [height, width];
      }

      return [width, height];
    }

    let [width, height] = PAGE_SIZES[pageSize];

    if (orientation === "landscape") {
      [width, height] = [height, width];
    } else if (orientation === "auto") {
      const imageIsLandscape = imageWidth > imageHeight;
      const pageIsLandscape = width > height;

      if (imageIsLandscape !== pageIsLandscape) {
        [width, height] = [height, width];
      }
    }

    return [width, height];
  }

  async function createPdf() {
    if (!state.items.length) {
      setStatus("Add at least one PDF or image first.", "error");
      return;
    }

    elements.createPdfButton.disabled = true;
    elements.addMoreButton.disabled = true;
    setStatus("Preparing PDF…");

    try {
      const pdfDocument = await PDFDocument.create();
      const { maxDimension, quality } = getCompressionSettings();
      const margin = Number(elements.margin.value);
      const shouldUseWhiteBackground = elements.whiteBackground.checked;

      pdfDocument.setCreator("PDF Merge Studio");
      pdfDocument.setProducer("pdf-lib");
      pdfDocument.setCreationDate(new Date());

      for (let index = 0; index < state.items.length; index += 1) {
        const item = state.items[index];
        setStatus(`Processing file ${index + 1} of ${state.items.length}…`);

        await new Promise((resolve) => requestAnimationFrame(resolve));

        if (item.type === "pdf") {
          const sourcePdf = await PDFDocument.load(item.pdfBytes, {
            updateMetadata: false,
          });
          const sourcePages = await pdfDocument.copyPages(
            sourcePdf,
            sourcePdf.getPageIndices(),
          );
          sourcePages.forEach((page) => pdfDocument.addPage(page));
          continue;
        }

        const canvas = renderEditedImageToCanvas(item, item.edit, {
          maxWidth: maxDimension || null,
          maxHeight: maxDimension || null,
          maxPixels: maxDimension ? maxDimension * maxDimension : 18_000_000,
          whiteBackground: shouldUseWhiteBackground,
        });

        const jpegBlob = await canvasToBlob(canvas, "image/jpeg", quality);
        const jpegBytes = await jpegBlob.arrayBuffer();
        const embeddedImage = await pdfDocument.embedJpg(jpegBytes);

        const [pageWidth, pageHeight] = resolvePageDimensions(
          embeddedImage.width,
          embeddedImage.height,
        );

        const page = pdfDocument.addPage([pageWidth, pageHeight]);

        if (shouldUseWhiteBackground) {
          page.drawRectangle({
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight,
            color: rgb(1, 1, 1),
          });
        }

        const availableWidth = Math.max(1, pageWidth - margin * 2);
        const availableHeight = Math.max(1, pageHeight - margin * 2);
        const scale = Math.min(
          availableWidth / embeddedImage.width,
          availableHeight / embeddedImage.height,
        );

        const drawWidth = embeddedImage.width * scale;
        const drawHeight = embeddedImage.height * scale;

        page.drawImage(embeddedImage, {
          x: (pageWidth - drawWidth) / 2,
          y: (pageHeight - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight,
        });
      }

      setStatus("Saving PDF…");
      const pdfBytes = await pdfDocument.save();
      const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = normalizePdfFileName(elements.fileName.value);
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 20_000);
      setStatus(`PDF created successfully — ${formatBytes(pdfBytes.length)}.`, "success");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Could not create the PDF.", "error");
    } finally {
      elements.createPdfButton.disabled = false;
      elements.addMoreButton.disabled = false;
    }
  }

  function preventDefaults(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, preventDefaults);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, () => {
      elements.dropZone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, () => {
      elements.dropZone.classList.remove("drag-over");
    });
  });

  elements.dropZone.addEventListener("drop", (event) => {
    addFiles(event.dataTransfer.files);
  });

  elements.dropZone.addEventListener("click", () => elements.fileInput.click());
  elements.dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      elements.fileInput.click();
    }
  });

  elements.fileInput.addEventListener("change", (event) => {
    addFiles(event.target.files);
  });

  elements.addMoreButton.addEventListener("click", () => elements.fileInput.click());
  elements.clearButton.addEventListener("click", clearAll);
  elements.createPdfButton.addEventListener("click", createPdf);

  elements.compressionPreset.addEventListener("change", applyCompressionPreset);
  elements.maxDimension.addEventListener("change", () => {
    elements.compressionPreset.selectedIndex = -1;
    elements.sizeEstimate.textContent = "Estimated size: —";
  });
  elements.quality.addEventListener("input", () => {
    elements.qualityOutput.value = `${elements.quality.value}%`;
    elements.sizeEstimate.textContent = "Estimated size: —";
  });
  elements.estimateSizeButton.addEventListener("click", estimatePdfSize);

  elements.closeEditorButton.addEventListener("click", closeEditor);
  elements.cancelEditButton.addEventListener("click", closeEditor);
  elements.applyEditButton.addEventListener("click", applyEditorChanges);
  elements.resetButton.addEventListener("click", resetTemporaryEdit);
  elements.rotateLeftButton.addEventListener("click", () => rotateTemporary(-90));
  elements.rotateRightButton.addEventListener("click", () => rotateTemporary(90));

  [
    elements.brightness,
    elements.contrast,
    elements.grayscale,
    elements.blackWhite,
    elements.threshold,
  ].forEach((control) => {
    control.addEventListener("input", () => {
      updateTemporaryEditFromControls();
      renderEditorPreview();
    });

    control.addEventListener("change", () => {
      updateTemporaryEditFromControls();
      renderEditorPreview();
    });
  });

  elements.editorDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeEditor();
  });

  elements.editorDialog.addEventListener("click", (event) => {
    if (event.target === elements.editorDialog) {
      closeEditor();
    }
  });
})();
