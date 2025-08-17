<?php
/**
 * BMIR RideSwap Admin - Get Private Configuration
 * Securely retrieves private configuration from config.private.json
 */

// Security headers
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
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
    // Define file path
    $configDir = dirname(__DIR__);
    $configFile = $configDir . '/config.private.json';
    
    // Check if config file exists
    if (!file_exists($configFile)) {
        // Return empty config structure if file doesn't exist
        echo json_encode([
            'privateKeys' => [],
            'adminEmail' => '',
            'notes' => '',
            'updatedAt' => null,
            'updatedBy' => null
        ]);
        exit;
    }
    
    // Check if file is readable
    if (!is_readable($configFile)) {
        throw new Exception('Configuration file not readable');
    }
    
    // Read and parse configuration file
    $configData = file_get_contents($configFile);
    if ($configData === false) {
        throw new Exception('Failed to read configuration file');
    }
    
    $config = json_decode($configData, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON in configuration file');
    }
    
    // Validate structure
    if (!isset($config['privateKeys']) || !is_array($config['privateKeys'])) {
        $config['privateKeys'] = [];
    }
    
    // Ensure all expected fields exist
    $config = array_merge([
        'privateKeys' => [],
        'adminEmail' => '',
        'notes' => '',
        'updatedAt' => null,
        'updatedBy' => null
    ], $config);
    
    // Return configuration (without sensitive metadata like updatedBy)
    echo json_encode([
        'privateKeys' => $config['privateKeys'],
        'adminEmail' => $config['adminEmail'],
        'notes' => $config['notes'],
        'updatedAt' => $config['updatedAt']
    ]);
    
} catch (Exception $e) {
    error_log('BMIR Admin Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to load configuration: ' . $e->getMessage()
    ]);
}
?>