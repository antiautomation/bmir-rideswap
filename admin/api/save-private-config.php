<?php
/**
 * BMIR RideSwap Admin - Save Private Configuration
 * Securely saves private configuration to config.private.json
 */

// Security headers
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Check if user is authenticated (Basic Auth should be handled by .htaccess)
if (!isset($_SERVER['PHP_AUTH_USER'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Authentication required']);
    exit;
}

try {
    // Get JSON input
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON input');
    }
    
    // Validate required structure
    if (!isset($data['privateKeys']) || !is_array($data['privateKeys'])) {
        throw new Exception('Invalid data structure: privateKeys required');
    }
    
    // Sanitize and validate data
    $config = [
        'privateKeys' => [],
        'adminEmail' => filter_var($data['adminEmail'] ?? '', FILTER_SANITIZE_EMAIL),
        'notes' => filter_var($data['notes'] ?? '', FILTER_SANITIZE_STRING),
        'updatedAt' => date('c'),
        'updatedBy' => $_SERVER['PHP_AUTH_USER']
    ];
    
    // Process private keys (sanitize but preserve structure)
    foreach ($data['privateKeys'] as $key => $value) {
        if (is_string($key) && is_string($value)) {
            $config['privateKeys'][$key] = $value;
        }
    }
    
    // Define file paths
    $configDir = dirname(__DIR__);
    $configFile = $configDir . '/config.private.json';
    $tempFile = $configDir . '/config.private.json.tmp';
    
    // Ensure directory exists and is writable
    if (!is_dir($configDir)) {
        if (!mkdir($configDir, 0750, true)) {
            throw new Exception('Cannot create config directory');
        }
    }
    
    if (!is_writable($configDir)) {
        throw new Exception('Config directory not writable');
    }
    
    // Write to temporary file first (atomic operation)
    $jsonData = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($jsonData === false) {
        throw new Exception('Failed to encode configuration data');
    }
    
    $bytesWritten = file_put_contents($tempFile, $jsonData, LOCK_EX);
    if ($bytesWritten === false) {
        throw new Exception('Failed to write temporary configuration file');
    }
    
    // Set proper permissions on temp file
    chmod($tempFile, 0640);
    
    // Atomic move (rename) to final location
    if (!rename($tempFile, $configFile)) {
        // Clean up temp file if move failed
        unlink($tempFile);
        throw new Exception('Failed to save configuration file');
    }
    
    // Set proper permissions on final file
    chmod($configFile, 0640);
    
    // Log the update (optional)
    $logFile = $configDir . '/admin.log';
    $logEntry = date('Y-m-d H:i:s') . ' - Config updated by ' . $_SERVER['PHP_AUTH_USER'] . "\n";
    file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
    
    // Return success response
    echo json_encode([
        'success' => true,
        'message' => 'Private configuration saved successfully',
        'updatedAt' => $config['updatedAt']
    ]);
    
} catch (Exception $e) {
    error_log('BMIR Admin Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to save configuration: ' . $e->getMessage()
    ]);
}
?>