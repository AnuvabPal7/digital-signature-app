package com.signature.signatureapp.config;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.Jwts.SIG;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Component;
import java.util.Date;

@Component
public class JwtUtils {

    // A secure, randomly generated key for signing tokens
    private final SecretKey key = SIG.HS256.key().build();
    
    // Token lasts for 24 hours
    private final long jwtExpirationMs = 86400000; 

    // Generate a token using the user's email
    public String generateToken(String email) {
        return Jwts.builder()
                .subject(email)
                .issuedAt(new Date())
                .expiration(new Date((new Date()).getTime() + jwtExpirationMs))
                .signWith(key)
                .compact();
    }

    // Extract email from a token
    public String getEmailFromToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
    }

    // Validate if the token is legitimate and not expired
    public boolean validateToken(String token) {
        try {
            Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}