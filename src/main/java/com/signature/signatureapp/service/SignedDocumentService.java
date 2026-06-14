package com.signature.signatureapp.service;

import com.signature.signatureapp.model.Document;
import com.signature.signatureapp.model.Signature;
import com.signature.signatureapp.repository.DocumentRepository;
import com.signature.signatureapp.repository.SignatureRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.util.List;

@Service
public class SignedDocumentService {

    private final DocumentRepository documentRepository;
    private final SignatureRepository signatureRepository;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    public SignedDocumentService(DocumentRepository documentRepository,
                                  SignatureRepository signatureRepository) {
        this.documentRepository = documentRepository;
        this.signatureRepository = signatureRepository;
    }

    /**
     * Generates a signed copy of the document with all saved signatures
     * stamped onto it as text, and locks it from further editing.
     *
     * @param documentId id of the source document
     * @return the File pointing to the newly generated signed PDF
     */
    public File generateSignedPdf(Long documentId) throws IOException {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + documentId));

        List<Signature> signatures = signatureRepository.findByDocumentId(documentId);

        if (signatures.isEmpty()) {
            throw new IllegalStateException("No signatures found for document: " + documentId);
        }

        // Only stamp the most recently placed signature, to avoid old test
        // signatures stacking up on the same document.
        Signature latest = signatures.get(signatures.size() - 1);

        File sourceFile = new File(document.getFilePath());

        try (PDDocument pdf = PDDocument.load(sourceFile)) {

            int pageIndex = latest.getPageNumber() - 1; // PDFBox pages are 0-indexed
            if (pageIndex >= 0 && pageIndex < pdf.getNumberOfPages()) {

                PDPage page = pdf.getPage(pageIndex);
                float pageHeight = page.getMediaBox().getHeight();

                // Frontend gives top-left origin (x, y). PDFBox uses bottom-left origin.
                float pdfX = latest.getX();
                float pdfY = pageHeight - latest.getY() - 55; // shift down to align with on-screen box

                String displayName = (latest.getSignerName() != null && !latest.getSignerName().isBlank())
                        ? latest.getSignerName()
                        : "User #" + latest.getUserId();

                try (PDPageContentStream contentStream = new PDPageContentStream(
                        pdf, page, PDPageContentStream.AppendMode.APPEND, true, true)) {

                    contentStream.beginText();
                    contentStream.setFont(PDType1Font.HELVETICA_OBLIQUE, 16);
                    contentStream.setNonStrokingColor(24, 95, 165); // SecureSign blue
                    contentStream.newLineAtOffset(pdfX, pdfY);
                    contentStream.showText(displayName);
                    contentStream.endText();
                }
            }

            // Mark document as read-only / final
            pdf.setAllSecurityToBeRemoved(false);

            File outputDir = new File(uploadDir, "signed");
            if (!outputDir.exists()) {
                outputDir.mkdirs();
            }

            String signedFileName = "signed_" + document.getId() + "_" + document.getFileName();
            File outputFile = new File(outputDir, signedFileName);

            pdf.save(outputFile);

            return outputFile;
        }
    }
}