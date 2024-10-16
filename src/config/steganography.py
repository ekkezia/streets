def encode_message(original_text, message):
    # Convert message to binary
    binary_message = ''.join(format(ord(char), '08b') for char in message)
    encoded_text = ""
    
    for char in original_text:
        if binary_message:
            if char == ' ':
                encoded_text += ' ' if binary_message[0] == '0' else '\t'
                binary_message = binary_message[1:]
            else:
                encoded_text += char
        else:
            encoded_text += char
            
    return encoded_text + original_text[len(encoded_text):]

def decode_message(encoded_text):
    binary_message = ""
    for char in encoded_text:
        if char == ' ':
            binary_message += '0'
        elif char == '\t':
            binary_message += '1'

    # Convert binary to characters
    decoded_message = ""
    for i in range(0, len(binary_message), 8):
        byte = binary_message[i:i + 8]
        if len(byte) == 8:
            decoded_message += chr(int(byte, 2))
    
    return decoded_message

# Example usage
original_text = "This is a test."
hidden_message = "Hi"

# Encode the message
encoded_text = encode_message(original_text, hidden_message)
print("Encoded Text: ", encoded_text)

# Decode the message
decoded_message = decode_message(encoded_text)
print("Decoded Message: ", decoded_message)
