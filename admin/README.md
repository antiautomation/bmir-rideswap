# BMIR RideSwap Admin Interface

This directory contains the lightweight admin configuration backend for BMIR RideSwap.

## 🔐 Security Setup

### 1. Basic Authentication Setup

The admin area is protected by Apache Basic Authentication. You need to set up a `.htpasswd` file:

```bash
# Create .htpasswd file (place it outside the web root for security)
htpasswd -c /path/outside/webroot/.htpasswd adminuser

# Add additional users (if needed)
htpasswd /path/outside/webroot/.htpasswd anotheruser
```

### 2. Update .htaccess Configuration

Edit `admin/.htaccess` and update the `AuthUserFile` path:

```apache
AuthUserFile /path/outside/webroot/.htpasswd
```

Replace `/path/outside/webroot/` with the actual path where you created the `.htpasswd` file.

### 3. File Permissions

Ensure proper file permissions:

```bash
# Set admin directory permissions
chmod 755 admin/
chmod 644 admin/*.html
chmod 644 admin/*.css
chmod 644 admin/*.js
chmod 644 admin/.htaccess

# Set API directory permissions
chmod 755 admin/api/
chmod 644 admin/api/*.php

# Create and secure private config file
touch admin/config.private.json
chmod 640 admin/config.private.json
```

## 🚀 Usage

### Accessing the Admin Interface

1. Navigate to `/admin/` on your server
2. Enter the username and password you created in the `.htpasswd` file
3. You'll see the admin dashboard with four main tabs

### Features

#### 📝 Posts Editor
- View all driver and rider listings in a spreadsheet-like interface
- Filter by type (driver/rider), direction, status, and date
- Edit individual posts inline or in a modal
- Toggle delete/restore status
- Export data to CSV
- Real-time updates

#### 🎪 Event Settings
- Configure event name, logos, and dates
- Set listing expiration duration
- Customize event copy (hero text, hints, footer)
- Settings are saved to Firestore and automatically applied to the public app

#### ⚙️ Configuration
- View and edit public configuration (Firebase, Analytics, reCAPTCHA)
- Download updated `config.js` file
- No server-side file modifications (safe for shared hosting)

#### 🔐 Private Settings
- Store sensitive API keys and admin notes
- Data is saved to `config.private.json` (protected by Basic Auth)
- Never exposed to the public app

## 📁 File Structure

```
admin/
├── index.html          # Main admin interface
├── admin.css           # Admin styles
├── admin.js            # Admin functionality
├── .htaccess           # Security configuration
├── README.md           # This file
├── config.private.json # Private configuration (created by admin)
└── api/
    ├── save-private-config.php  # Save private settings
    └── get-private-config.php   # Load private settings
```

## 🔧 Configuration

### Public Configuration
The admin interface reads from `../config.js` to populate the configuration forms. Make sure this file exists and contains valid Firebase configuration.

### Private Configuration
Private settings are stored in `config.private.json` and are never exposed to the public app. This file is created automatically when you first save private settings.

## 🛡️ Security Features

- **Basic Authentication**: All admin access requires username/password
- **File Protection**: Private config files are protected by `.htaccess`
- **Input Validation**: All form inputs are sanitized
- **Atomic Writes**: Configuration files are written atomically to prevent corruption
- **Error Logging**: Admin actions are logged for audit purposes
- **CORS Protection**: Admin APIs are same-origin only

## 🚨 Important Notes

1. **Never commit `config.private.json`** to version control
2. **Place `.htpasswd` outside the web root** for maximum security
3. **Use HTTPS** in production to protect credentials
4. **Regular backups** of your configuration files
5. **Monitor logs** for suspicious activity

## 🔄 Integration with Public App

The admin interface integrates seamlessly with the public app:

- **Event Settings**: Automatically applied to the public app via Firestore
- **Configuration**: Public app continues to use `config.js` (unchanged)
- **Posts Management**: Direct Firestore operations (no server-side processing)
- **Zero Impact**: Public app functionality remains unchanged

## 🐛 Troubleshooting

### Common Issues

1. **Authentication Fails**
   - Check `.htpasswd` file path in `.htaccess`
   - Verify file permissions
   - Ensure Apache mod_auth is enabled

2. **Firebase Connection Fails**
   - Verify `config.js` contains valid Firebase configuration
   - Check browser console for Firebase errors
   - Ensure Firebase project has Firestore enabled

3. **Cannot Save Settings**
   - Check file permissions on `admin/` directory
   - Verify PHP has write access
   - Check server error logs

4. **Admin Interface Not Loading**
   - Ensure all admin files are copied to distribution
   - Check that `.htaccess` is included in build
   - Verify Firebase SDK is loading correctly

### Debug Mode

Enable debug mode by adding `?debug=true` to the admin URL to see additional logging information.

## 📞 Support

For issues or questions about the admin interface, check the main project README or create an issue in the repository.