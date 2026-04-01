!macro customInit
  ; Bring installer to front (critical after UAC elevation — otherwise buried behind other windows)
  BringToFront

  ; Check if MacroVox is currently running
  nsExec::ExecToStack 'cmd /c tasklist /FI "IMAGENAME eq MacroVox.exe" /NH 2>nul | findstr /I "MacroVox.exe"'
  Pop $0
  ${If} $0 == 0
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "MacroVox is currently running.$\r$\n$\r$\nClick OK to close it and continue installing, or Cancel to abort." IDOK killIt
    Abort
    killIt:
      nsExec::ExecToLog 'taskkill /F /IM "MacroVox.exe"'
      ; Poll until the process is fully gone (up to 8 s) so file handles are
      ; released before the upgrade uninstaller runs.
      StrCpy $9 0
      pollExit:
        Sleep 1000
        IntOp $9 $9 + 1
        ${If} $9 >= 8
          Goto pollDone
        ${EndIf}
        nsExec::ExecToStack 'cmd /c tasklist /FI "IMAGENAME eq MacroVox.exe" /NH 2>nul | findstr /I "MacroVox.exe"'
        Pop $0
        ${If} $0 == 0
          Goto pollExit
        ${EndIf}
      pollDone:
  ${EndIf}

  ; NOTE: Previous-version uninstall is handled in customInstall (below).
  ; Do NOT put uninstall prompts here — customInit runs in .onInit which fires
  ; TWICE when UAC elevation occurs (once non-elevated, once elevated), causing
  ; a double-prompt. customInstall runs only once, after elevation + file extraction.
!macroend

!macro customInstall
  ; --- Uninstall previous versions from DIFFERENT directories ---
  ; Same-directory upgrades are handled by electron-builder (files overwritten).
  ; We only need to prompt if an old install exists at a different path.
  ; This macro runs once, after UAC elevation, so no double-prompt.

  ; Check per-user install (HKCU) in a different directory
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "UninstallString"
  ReadRegStr $2 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "InstallLocation"
  ${If} $0 != ""
  ${AndIf} $2 != ""
  ${AndIf} $2 != "$INSTDIR"
  ${AndIf} $2 != "$INSTDIR\"
    ReadRegStr $1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "DisplayVersion"
    MessageBox MB_YESNO|MB_ICONQUESTION "A previous version of MacroVox (v$1) was found at:$\r$\n$2$\r$\n$\r$\nWould you like to remove it?$\r$\n(Recommended: Yes)" IDYES removePrevHKCU IDNO skipPrevHKCU
    removePrevHKCU:
      ExecWait '"$0" /S'
      Sleep 2000
    skipPrevHKCU:
  ${EndIf}

  ; Check per-machine install (HKLM) in a different directory
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "UninstallString"
  ReadRegStr $2 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "InstallLocation"
  ${If} $0 != ""
  ${AndIf} $2 != ""
  ${AndIf} $2 != "$INSTDIR"
  ${AndIf} $2 != "$INSTDIR\"
    ReadRegStr $1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "DisplayVersion"
    MessageBox MB_YESNO|MB_ICONQUESTION "A previous system-wide installation of MacroVox (v$1) was found at:$\r$\n$2$\r$\n$\r$\nWould you like to remove it?$\r$\n(Recommended: Yes)" IDYES removePrevHKLM IDNO skipPrevHKLM
    removePrevHKLM:
      ExecWait '"$0" /S'
      Sleep 2000
    skipPrevHKLM:
  ${EndIf}

  ; --- Force create shortcuts (electron-builder's checkbox is unreliable) ---
  ; perMachine=true: installer runs as admin so $DESKTOP = C:\Users\Public\Desktop
  ; and $SMPROGRAMS = C:\ProgramData\Microsoft\Windows\Start Menu\Programs (correct).
  CreateDirectory "$SMPROGRAMS\MacroVox"
  CreateShortCut "$SMPROGRAMS\MacroVox\MacroVox.lnk" "$INSTDIR\MacroVox.exe" "" "$INSTDIR\MacroVox.exe" 0
  CreateShortCut "$DESKTOP\MacroVox.lnk" "$INSTDIR\MacroVox.exe" "" "$INSTDIR\MacroVox.exe" 0
!macroend

!macro customUnInstall
  ; Clean up shortcuts on uninstall
  Delete "$DESKTOP\MacroVox.lnk"
  Delete "$SMPROGRAMS\MacroVox\MacroVox.lnk"
  RMDir "$SMPROGRAMS\MacroVox"
!macroend
