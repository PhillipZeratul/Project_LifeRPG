use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
async fn open_view(app: AppHandle, view_name: String) -> Result<(), String> {
    open_or_focus_view(&app, &view_name).map_err(|e| e.to_string())
}

fn open_or_focus_view(app: &AppHandle, view_name: &str) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(&view_name) {
        window.show()?;
        window.set_focus()?;
        #[cfg(debug_assertions)]
        {
            window.open_devtools();
        }
        return Ok(());
    }

    let (url_path, width, height, always_on_top) = match view_name {
        "routine-time-tracker" => ("index.html#/routine-time-tracker", 400.0, 600.0, true),
        _ => ("index.html#/master-hub", 800.0, 600.0, false),
    };

    WebviewWindowBuilder::new(app, view_name, WebviewUrl::App(url_path.into()))
        .title(match view_name {
            "routine-time-tracker" => "Routine Time Tracker",
            _ => "LifeRPG Hub",
        })
        .inner_size(width, height)
        .always_on_top(always_on_top)
        .build()?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let mut target_view = "master-hub";
            let mut iter = args.iter();
            while let Some(arg) = iter.next() {
                if arg == "--view" {
                    if let Some(view_name) = iter.next() {
                        target_view = view_name.as_str();
                    }
                }
            }
            let _ = open_or_focus_view(app, target_view);
        }))
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![open_view])
        .setup(|app| {
            open_or_focus_view(app.handle(), "main")?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
