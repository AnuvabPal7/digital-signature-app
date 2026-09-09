package com.signature.signatureapp.service;

import com.signature.signatureapp.model.Document;
import com.signature.signatureapp.model.Signature;
import com.signature.signatureapp.repository.DocumentRepository;
import com.signature.signatureapp.repository.SignatureRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;

@Service
public class SignedDocumentService {

    private final DocumentRepository documentRepository;
    private final SignatureRepository signatureRepository;
    private final S3StorageService s3StorageService;

    public SignedDocumentService(DocumentRepository documentRepository,
                                  SignatureRepository signatureRepository,
                                  S3StorageService s3StorageService) {
        this.documentRepository = documentRepository;
        this.signatureRepository = signatureRepository;
        this.s3StorageService = s3StorageService;
    }

    /**
     * FIX: previously loaded the source PDF from a local File and wrote
     * the signed output back to a local "uploads/signed" folder - both
     * broken by Render's ephemeral disk. The source now comes from S3,
     * and since this PDF is generated fresh on every request anyway (it's
     * not read back later by anything else), the output is kept in
     * memory and streamed directly rather than written to disk at all.
     */
    public byte[] generateSignedPdf(Long documentId) throws IOException {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + documentId));

        List<Signature> signatures = signatureRepository.findByDocumentId(documentId);

        if (signatures.isEmpty()) {
            throw new IllegalStateException("No signatures found for document: " + documentId);
        }

        Signature latest = signatures.get(signatures.size() - 1);

        byte[] sourceBytes = s3StorageService.download(document.getFilePath());

        try (PDDocument pdf = PDDocument.load(sourceBytes)) {

            int pageIndex = latest.getPageNumber() - 1;
            if (pageIndex >= 0 && pageIndex < pdf.getNumberOfPages()) {

                PDPage page = pdf.getPage(pageIndex);
                float pageHeight = page.getMediaBox().getHeight();

                float pdfX = latest.getX() + 60;
                float pdfY = pageHeight - latest.getY() - 30;

                String displayName = (latest.getSignerName() != null && !latest.getSignerName().isBlank())
                        ? latest.getSignerName()
                        : "User #" + latest.getUserId();

                int[] rgb = {24, 95, 165}; // default SecureSign blue
                if (latest.getSignatureColor() != null && !latest.getSignatureColor().isBlank()) {
                    try {
                        String[] parts = latest.getSignatureColor().split(",");
                        rgb = new int[]{
                                Integer.parseInt(parts[0].trim()),
                                Integer.parseInt(parts[1].trim()),
                                Integer.parseInt(parts[2].trim())
                        };
                    } catch (Exception ignored) {}
                }

                PDFont font = loadFont(pdf, latest.getFontName());
                float fontSize = (latest.getFontName() != null && !latest.getFontName().equals("Plain")) ? 22f : 16f;

                try (PDPageContentStream contentStream = new PDPageContentStream(
                        pdf, page, PDPageContentStream.AppendMode.APPEND, true, true)) {

                    if (latest.getSignatureImageBase64() != null && !latest.getSignatureImageBase64().isBlank()) {
                        byte[] imageBytes = java.util.Base64.getDecoder().decode(latest.getSignatureImageBase64());
                        org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject image =
                                org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject.createFromByteArray(pdf, imageBytes, "signature");
                        float imgWidth = 160f;
                        float imgHeight = 60f;
                        contentStream.drawImage(image, pdfX - 60, pdfY - imgHeight + 30, imgWidth, imgHeight);
                    } else {
                        contentStream.beginText();
                        contentStream.setFont(font, fontSize);
                        contentStream.setNonStrokingColor(rgb[0], rgb[1], rgb[2]);
                        contentStream.newLineAtOffset(pdfX, pdfY);
                        contentStream.showText(displayName);
                        contentStream.endText();
                    }
                }
            }

            pdf.setAllSecurityToBeRemoved(false);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            pdf.save(baos);
            return baos.toByteArray();
        }
    }

    private PDFont loadFont(PDDocument pdf, String fontName) {
        if (fontName == null || fontName.isBlank() || fontName.equals("Plain")) {
            return PDType1Font.HELVETICA;
        }

        String resourcePath = switch (fontName) {
            case "Allura" -> "/fonts/Allura-Regular.ttf";
            default -> null;
        };

        if (resourcePath != null) {
            try (InputStream is = getClass().getResourceAsStream(resourcePath)) {
                if (is != null) {
                    return PDType0Font.load(pdf, is, true);
                }
            } catch (IOException e) {
                System.err.println("Failed to load font: " + fontName + " — falling back to Helvetica Oblique");
            }
        }

        return PDType1Font.HELVETICA_OBLIQUE;
    }
}
