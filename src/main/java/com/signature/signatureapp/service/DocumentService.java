package com.signature.signatureapp.service;

import com.signature.signatureapp.model.Document;
import com.signature.signatureapp.model.User;
import com.signature.signatureapp.repository.DocumentRepository;
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

    private final String uploadDir = System.getProperty("user.dir") + "/uploads";

    public DocumentService(DocumentRepository documentRepository, UserRepository userRepository) {
        this.documentRepository = documentRepository;
        this.userRepository = userRepository;
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
}