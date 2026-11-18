use std::ffi::CString;
use std::os::unix::ffi::OsStrExt;
use std::path::Path;

/// 读取任意长度的扩展属性。
///
/// 不用 `xattr` crate：它在 macOS 上先用 4KiB 栈缓冲读一次，而
/// `getxattr` 在缓冲不足时不会报 ERANGE，只返回读到的字节数——
/// Finder 写出来的资源叉动辄几百 KB，会被静默截断成 4KiB，
/// 导致自定义图标解析失败。这里先用 size=0 查询真实长度，
/// 再按真实长度读取。
pub fn read(path: &Path, name: &str) -> Option<Vec<u8>> {
    let path = CString::new(path.as_os_str().as_bytes()).ok()?;
    let name = CString::new(name).ok()?;

    let size =
        unsafe { libc::getxattr(path.as_ptr(), name.as_ptr(), std::ptr::null_mut(), 0, 0, 0) };
    if size <= 0 {
        return None;
    }

    let mut buffer = vec![0u8; size as usize];
    let read = unsafe {
        libc::getxattr(
            path.as_ptr(),
            name.as_ptr(),
            buffer.as_mut_ptr().cast(),
            buffer.len(),
            0,
            0,
        )
    };
    if read < 0 || read as usize != buffer.len() {
        return None;
    }
    Some(buffer)
}

#[cfg(test)]
pub fn write(path: &Path, name: &str, value: &[u8]) -> bool {
    let Ok(path) = CString::new(path.as_os_str().as_bytes()) else {
        return false;
    };
    let Ok(name) = CString::new(name) else {
        return false;
    };
    let result = unsafe {
        libc::setxattr(
            path.as_ptr(),
            name.as_ptr(),
            value.as_ptr().cast(),
            value.len(),
            0,
            0,
        )
    };
    result == 0
}
