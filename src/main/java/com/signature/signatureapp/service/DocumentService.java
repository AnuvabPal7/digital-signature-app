package com.signature.signatureapp.service;

import com.signature.signatureapp.model.Document;
import com.signature.signatureapp.model.User;
import com.signature.signatureapp.repository.DocumentRepository;
import com.signature.signatureapp.repository.SignatureRepository;
import com.signature.signatureapp.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final SignatureRepository signatureRepository;

    private final String uploadDir = System.getProperty("user.dir") + "/uploads";

    public DocumentService(DocumentRepository documentRepository,
                            UserRepository userRepository,
                            SignatureRepository signatureRepository) {
        this.documentRepository = documentRepository;
        this.userRepository = userRepository;
        this.signatureRepository = signatureRepository;
    }

    public Document uploadFile(MultipartFile file, Long userId) throws IOException {

        Optional<User> userOpt = userRepository.findById(userId);

        if (userOpt.isEmpty()) {
            throw new RuntimeException("User not found");
        }

        User user = userOpt.get();

        File folder = new File(uploadDir);
        if (!folder.exists()) {
            folder.mkdirs();
        }

        String originalName = file.getOriginalFilename();
        String uniqueName = UUID.randomUUID() + "_" + originalName;

        Path filePath = Paths.get(uploadDir, uniqueName);

        Files.copy(file.getInputStream(), filePath);

        Document doc = new Document();
        doc.setFileName(originalName);
        doc.setFilePath(filePath.toString());
        doc.setFileType(file.getContentType());
        doc.setFileSize(file.getSize());
        doc.setUser(user);

        return documentRepository.save(doc);
    }

    public List<Document> getUserDocuments(Long userId) {
        return documentRepository.findByUserId(userId);
    }

    public Document getDocumentById(Long id) {
        return documentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Document not found"));
    }

    public void deleteDocument(Long id) {
        Document doc = documentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Document not found"));

        // Remove any signatures associated with this document first
        signatureRepository.deleteAll(signatureRepository.findByDocumentId(id));

        // Delete the physical file from disk, if it exists
        File file = new File(doc.getFilePath());
        if (file.exists()) {
            file.delete();
        }

        documentRepository.delete(doc);
    }
}