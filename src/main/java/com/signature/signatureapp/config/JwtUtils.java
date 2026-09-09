package com.signature.signatureapp.config;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtils {

    // FIX: previously "SIG.HS256.key().build()" generated a brand new random key
    // every time the app started, which silently invalidated every existing JWT
    // on every restart/redeploy. The key now comes from an env var so tokens
    // stay valid across restarts and across multiple instances.
    private final SecretKey key;

    // Token lasts for 24 hours
    private final long jwtExpirationMs = 86400000;

    public JwtUtils(@Value("${app.jwt-secret}") String jwtSecret) {
        // jwtSecret must be a long, random string (32+ chars recommended).
        // Generate one locally with: openssl rand -base64 32
        this.key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

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
