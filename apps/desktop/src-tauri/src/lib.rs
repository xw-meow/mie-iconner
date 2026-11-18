mod admin_helper;
mod apps;
mod commands;
mod error;
mod folder;
mod library;
mod macos;
mod models;
mod paths;
mod state;
mod suggest;
mod text;
mod thumbnails;

use tauri::Manager;

use state::AppState;

/// 供 main 在启动 Tauri 之前判断是否为管理员 helper 模式。
pub fn run_admin_helper_if_requested() -> bool {
    admin_helper::run_if_requested()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 窗口尺寸/位置恢复；关闭时只记住大小与位置
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let state = AppState::create(app.handle())?;
            state.ensure_directories();
            app.manage(state);

            // 标准 macOS 菜单（含编辑菜单，保证输入框的 ⌘C/⌘V 可用）
            let menu = tauri::menu::Menu::default(app.handle())?;
            app.set_menu(menu)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::apps::list_apps,
            commands::apps::apply_app_icon,
            commands::apps::restore_app_icon,
            commands::env::get_env,
            commands::env::resolve_path,
            commands::env::suggest_paths,
            commands::folders::list_folders,
            commands::folders::restart_finder,
            commands::library::list_library,
            commands::library::import_icons,
            commands::library::create_category,
            commands::library::delete_icon,
            commands::library::delete_category,
            commands::icons::apply_icon,
            commands::icons::restore_icon,
            commands::icons::thumbnail,
        ])
        .run(tauri::generate_context!())
        .expect("启动小羊贴纸铺失败");
}
