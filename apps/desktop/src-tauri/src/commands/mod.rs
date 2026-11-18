pub mod apps;
pub mod env;
pub mod folders;
pub mod icons;
pub mod library;

use crate::error::AppError;

/// 把可能阻塞的文件系统/解码工作放到 blocking 线程池：
/// Tauri 的同步 command 跑在主线程上，直接做 IO 会卡住窗口。
pub(crate) async fn blocking<T, F>(task: F) -> Result<T, AppError>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, AppError> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| AppError::new("internal", error.to_string()))?
}
