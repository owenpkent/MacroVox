#Requires AutoHotkey v2.0

; MacroVox - Voice-controlled macro executor
; Usage: AutoHotkey.exe MacroVox.ahk --keyword=undo --profile=premiere

#SingleInstance Force
SetWorkingDir A_ScriptDir

; Parse command-line arguments
keyword := ""
profile := ""

for param in A_Args {
    if InStr(param, "--keyword=") {
        keyword := SubStr(param, 11)
    } else if InStr(param, "--profile=") {
        profile := SubStr(param, 11)
    }
}

; Map keywords to keys (hardcoded for now)
keys := GetKeys(keyword, profile)

if (keys = "") {
    ExitApp 1
}

; Send the keys to the active window (no target checking)
; This allows commands to work with any application
Send keys
Sleep 100  ; Small delay to ensure keys are processed
ExitApp 0

; ============================================================================
; Functions
; ============================================================================

GetKeys(keyword, profile) {
    ; Premiere profile
    if (profile = "premiere") {
        switch keyword {
            case "undo": return "^z"
            case "control undo": return "^z"
            case "redo": return "^y"
            case "cut": return "^k"
            case "split": return "^k"
            case "razor": return "^k"
            case "render": return "^m"
            case "next frame": return "{Right}"
            case "previous frame": return "{Left}"
            case "play": return "{Space}"
            case "reload": return "^r"
            case "zoom in": return "^+"
            case "zoom out": return "^-"
            case "control victor": return "^v"
            case "control charlie": return "^c"
        }
    }
    
    ; Resolve profile
    if (profile = "resolve") {
        switch keyword {
            case "undo": return "^z"
            case "redo": return "^y"
            case "cut": return "^b"
            case "split": return "^b"
            case "next frame": return "{Right}"
            case "previous frame": return "{Left}"
            case "play": return "{Space}"
        }
    }
    
    ; Gaming profile
    if (profile = "gaming") {
        switch keyword {
            case "reload": return "r"
            case "jump": return "{Space}"
            case "crouch": return "c"
            case "sprint": return "{LShift}"
            case "melee": return "v"
        }
    }
    
    return ""
}
