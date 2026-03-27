import Foundation
import Vision
import ImageIO

struct OCRBox: Codable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct OCRLine: Codable {
    let text: String
    let confidence: Float
    let box: OCRBox
}

enum OCRToolError: Error, LocalizedError {
    case usage
    case imageSource
    case imageDecode

    var errorDescription: String? {
        switch self {
        case .usage:
            return "Usage: vision_ocr <image-path> [max-results]"
        case .imageSource:
            return "Failed to create image source."
        case .imageDecode:
            return "Failed to decode image."
        }
    }
}

do {
    let args = Array(CommandLine.arguments.dropFirst())
    guard let imagePath = args.first else {
        throw OCRToolError.usage
    }

    let maxResults = args.count > 1 ? Int(args[1]) ?? 80 : 80
    let imageURL = URL(fileURLWithPath: imagePath) as CFURL

    guard let source = CGImageSourceCreateWithURL(imageURL, nil) else {
        throw OCRToolError.imageSource
    }
    guard let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw OCRToolError.imageDecode
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try handler.perform([request])

    let lines: [OCRLine] = (request.results ?? [])
        .prefix(maxResults)
        .compactMap { observation in
            guard let candidate = observation.topCandidates(1).first else {
                return nil
            }

            let box = observation.boundingBox
            return OCRLine(
                text: candidate.string,
                confidence: candidate.confidence,
                box: OCRBox(
                    x: Double(box.origin.x),
                    y: Double(box.origin.y),
                    width: Double(box.size.width),
                    height: Double(box.size.height)
                )
            )
        }

    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .withoutEscapingSlashes]
    let data = try encoder.encode(lines)
    FileHandle.standardOutput.write(data)
} catch {
    let message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
}
