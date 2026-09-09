package com.signature.signatureapp.controller;

import com.signature.signatureapp.model.Document;
import com.signature.signatureapp.model.User;
import com.signature.signatureapp.service.DocumentService;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/docs")
public class DocumentController {

    private final DocumentService documentService;

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    // FIX: identity now comes from the token JwtAuthFilter already verified,
    // never from a client-supplied value. This is the single source of
    // truth for "who is making this request" across every method below.
    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (User) auth.getPrincipal();
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadDocument(@RequestParam("file") MultipartFile file) {
        try {
            Document doc = documentService.uploadFile(file, currentUser().getId());
            return ResponseEntity.ok(doc);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // FIX: {userId} removed from the path entirely - a caller can no longer
    // ask for anyone else's documents by changing a path variable. This
    // always returns the authenticated caller's own documents.
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Document>> getUserDocuments(@PathVariable Long userId) {
        List<Document> docs = documentService.getUserDocuments(currentUser().getId());
        return ResponseEntity.ok(docs);
    }

    @GetMapping("/view/{id}")
    public ResponseEntity<Resource> viewPdf(@PathVariable Long id) {
        try {
            Document document = documentService.getDocumentById(id);

            // FIX: previously any authenticated (or, before the filter
            // existed, any) request could view any document by guessing an
            // ID. Now the owner is checked before the file is streamed.
            if (!document.getUser().getId().equals(currentUser().getId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            Path filePath = Paths.get(document.getFilePath());
            Resource resource = new UrlResource(filePath.toUri());

            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_PDF)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                    .body(resource);

        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDocument(@PathVariable Long id) {
        try {
            Document document = documentService.getDocumentById(id);

            // FIX: same ownership check as viewPdf - previously anyone
            // could delete any document by ID with no ownership check.
            if (!document.getUser().getId().equals(currentUser().getId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "You do not have permission to delete this document"));
            }

            documentService.deleteDocument(id);
            return ResponseEntity.ok(Map.of("message", "Document deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
