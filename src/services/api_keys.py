"""
MacroVox Secure API Key Management
Uses Windows Credential Manager via keyring for secure storage
"""

import keyring

# Service name for keyring storage
SERVICE_NAME = "MacroVox"


def get_api_key(key_name: str) -> str | None:
    """
    Retrieve an API key from secure storage.
    
    Args:
        key_name: Name of the key (e.g., "deepgram", "anthropic")
        
    Returns:
        The API key string, or None if not found.
    """
    try:
        return keyring.get_password(SERVICE_NAME, key_name)
    except Exception:
        return None


def set_api_key(key_name: str, api_key: str) -> bool:
    """
    Store an API key in secure storage.
    
    Args:
        key_name: Name of the key (e.g., "deepgram", "anthropic")
        api_key: The API key to store
        
    Returns:
        True if successful, False otherwise.
    """
    try:
        keyring.set_password(SERVICE_NAME, key_name, api_key)
        return True
    except Exception:
        return False


def delete_api_key(key_name: str) -> bool:
    """
    Delete an API key from secure storage.
    
    Args:
        key_name: Name of the key to delete
        
    Returns:
        True if successful, False otherwise.
    """
    try:
        keyring.delete_password(SERVICE_NAME, key_name)
        return True
    except Exception:
        return False


def has_api_key(key_name: str) -> bool:
    """
    Check if an API key exists in secure storage.
    
    Args:
        key_name: Name of the key to check
        
    Returns:
        True if the key exists, False otherwise.
    """
    return get_api_key(key_name) is not None


# Convenience constants for key names
DEEPGRAM_KEY = "deepgram"
ANTHROPIC_KEY = "anthropic"
