$rootFolder = "E:\WORK\Web\Project_LifeRPG\Project_LifeRPG"

code $rootFolder

Start-Process "warp://tab_config/life_rpg_tab_config"

$exePath = "$env:LOCALAPPDATA\Programs\antigravity\Antigravity.exe"
$workDir = "$env:LOCALAPPDATA\Programs\antigravity"
Start-Process -FilePath $exePath -WorkingDirectory $workDir

# $githubDesktopPath = "$env:LOCALAPPDATA\GitHubDesktop\GitHubDesktop.exe"
# Start-Process -FilePath $githubDesktopPath -ArgumentList $rootFolder
