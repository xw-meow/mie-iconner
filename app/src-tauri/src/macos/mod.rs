pub mod icons;
pub mod xattr;

use tauri::AppHandle;

use crate::error::AppError;

/// 把 AppKit 调用调度到主线程并等待结果。
/// Tauri 的 async command 跑在 worker 线程上，NSWorkspace /
/// NSImage 这类 AppKit API 必须回主线程执行。
pub async fn run_on_main<T, F>(app: &AppHandle, task: F) -> Result<T, AppError>
where
    T: Send + 'static,
    F: FnOnce() -> T + Send + 'static,
{
    let (sender, receiver) = tokio::sync::oneshot::channel();
    app.run_on_main_thread(move || {
        let _ = sender.send(task());
    })
    .map_err(|error| AppError::new("main_thread", error.to_string()))?;
    receiver
        .await
        .map_err(|_| AppError::new("main_thread", "主线程任务已取消"))
}
