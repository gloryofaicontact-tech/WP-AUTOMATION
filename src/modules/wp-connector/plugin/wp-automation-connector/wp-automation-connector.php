<?php
/**
 * Plugin Name: WP-Automation Connector
 * Description: One-click connection between your WordPress site and the WP-Automation platform without manually creating Application Passwords.
 * Version: 1.0.0
 * Author: WP-Automation
 * License: GPLv2 or later
 */

if (!defined('ABSPATH')) {
    exit;
}

class WP_Automation_Connector {
    const OPTION_KEY = 'wp_automation_connector_status';
    const MENU_SLUG = 'wp-automation-connector';

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'register_menu']);
        add_action('admin_post_wp_automation_connect', [__CLASS__, 'handle_connect']);
    }

    public static function register_menu() {
        add_options_page(
            'WP-Automation Connector',
            'WP-Automation',
            'manage_options',
            self::MENU_SLUG,
            [__CLASS__, 'render_settings_page']
        );
    }

    public static function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        $prefill_token = isset($_GET['token']) ? sanitize_text_field(wp_unslash($_GET['token'])) : '';
        $prefill_api   = isset($_GET['api']) ? esc_url_raw(wp_unslash($_GET['api'])) : 'https://api.quicksite.asia/api/v1/wp-connector/connect';
        $status        = get_option(self::OPTION_KEY, []);
        $notice        = isset($_GET['wpa_msg']) ? sanitize_text_field(wp_unslash($_GET['wpa_msg'])) : '';
        $notice_type   = isset($_GET['wpa_type']) ? sanitize_text_field(wp_unslash($_GET['wpa_type'])) : 'info';
        ?>
        <div class="wrap">
            <h1>WP-Automation Connector</h1>
            <p>Connect this WordPress site to your WP-Automation dashboard in one click.</p>

            <?php if ($notice) : ?>
                <div class="notice notice-<?php echo esc_attr($notice_type); ?> is-dismissible">
                    <p><?php echo esc_html($notice); ?></p>
                </div>
            <?php endif; ?>

            <?php if (!empty($status['connected'])) : ?>
                <div class="card" style="max-width:600px;padding:16px 20px;margin-top:16px;border-left:4px solid #10b981;">
                    <h2 style="margin-top:0;color:#047857;">Connected to WP-Automation</h2>
                    <p><strong>Connected User:</strong> <?php echo esc_html($status['username'] ?? ''); ?></p>
                    <p><strong>Website ID:</strong> <code><?php echo esc_html($status['websiteId'] ?? ''); ?></code></p>
                    <p><strong>Connected At:</strong> <?php echo esc_html($status['connectedAt'] ?? ''); ?></p>
                </div>
            <?php endif; ?>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="max-width:600px;margin-top:20px;background:#fff;padding:20px;border:1px solid #dcdcde;border-radius:6px;">
                <?php wp_nonce_field('wp_automation_connect_nonce'); ?>
                <input type="hidden" name="action" value="wp_automation_connect" />

                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="wpa_connect_endpoint">WP-Automation API Endpoint</label></th>
                        <td>
                            <input name="connect_endpoint" id="wpa_connect_endpoint" type="url" class="regular-text" style="width:100%;" value="<?php echo esc_attr($prefill_api); ?>" required />
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="wpa_connect_token">One-Time Connect Token</label></th>
                        <td>
                            <textarea name="connect_token" id="wpa_connect_token" rows="3" class="large-text code" placeholder="Paste your 10-minute Connect Token from WP-Automation..." required><?php echo esc_textarea($prefill_token); ?></textarea>
                        </td>
                    </tr>
                </table>

                <p class="submit">
                    <button type="submit" class="button button-primary button-hero">
                        <?php echo !empty($status['connected']) ? 'Reconnect This Site' : 'Connect This Site'; ?>
                    </button>
                </p>
            </form>
        </div>
        <?php
    }

    public static function handle_connect() {
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }

        check_admin_referer('wp_automation_connect_nonce');

        $connect_token    = isset($_POST['connect_token']) ? sanitize_text_field(wp_unslash($_POST['connect_token'])) : '';
        $connect_endpoint = isset($_POST['connect_endpoint']) ? esc_url_raw(wp_unslash($_POST['connect_endpoint'])) : '';

        if (empty($connect_token) || empty($connect_endpoint)) {
            self::redirect_with_message('Connect Token and API Endpoint are required.', 'error');
        }

        if (!class_exists('WP_Application_Passwords') || !wp_is_application_passwords_available()) {
            self::redirect_with_message('WordPress Application Passwords are disabled on this site. Please enable HTTPS or Application Passwords.', 'error');
        }

        $current_user = wp_get_current_user();
        $app_name     = 'WP-Automation (' . gmdate('Y-m-d H:i') . ')';
        $created      = WP_Application_Passwords::create_new_application_password($current_user->ID, ['name' => $app_name]);

        if (is_wp_error($created)) {
            self::redirect_with_message('Could not create WordPress credentials: ' . $created->get_error_message(), 'error');
        }

        $app_password = $created[0];
        $payload = [
            'connectToken'        => $connect_token,
            'url'                 => get_site_url(),
            'name'                => get_bloginfo('name'),
            'username'            => $current_user->user_login,
            'applicationPassword' => $app_password,
        ];

        $response = wp_remote_post($connect_endpoint, [
            'headers' => ['Content-Type' => 'application/json'],
            'body'    => wp_json_encode($payload),
            'timeout' => 30,
        ]);

        if (is_wp_error($response)) {
            self::redirect_with_message('Connection failed: ' . $response->get_error_message(), 'error');
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code < 200 || $code >= 300) {
            $err = $body['message'] ?? ('HTTP ' . $code);
            if (is_array($err)) {
                $err = implode(', ', $err);
            }
            self::redirect_with_message('WP-Automation rejected connection: ' . $err, 'error');
        }

        $data = $body['data'] ?? $body;
        update_option(self::OPTION_KEY, [
            'connected'   => true,
            'websiteId'   => $data['websiteId'] ?? '',
            'username'    => $current_user->user_login,
            'connectedAt' => gmdate('Y-m-d H:i:s') . ' UTC',
        ]);

        self::redirect_with_message('Site connected to WP-Automation successfully! You can return to your dashboard.', 'success');
    }

    private static function redirect_with_message($msg, $type = 'info') {
        $url = add_query_arg(
            [
                'page'     => self::MENU_SLUG,
                'wpa_msg'  => $msg,
                'wpa_type' => $type,
            ],
            admin_url('options-general.php')
        );
        wp_safe_redirect($url);
        exit;
    }
}

WP_Automation_Connector::init();
