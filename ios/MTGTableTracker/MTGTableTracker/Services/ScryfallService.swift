import Foundation

struct ScryfallService {
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func autocomplete(query: String) async throws -> [String] {
        guard query.count >= 2 else { return [] }
        var components = URLComponents(string: "https://api.scryfall.com/cards/autocomplete")!
        components.queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "include_extras", value: "false")
        ]
        let (data, response) = try await session.data(from: components.url!)
        try validate(response)
        let decoded = try JSONDecoder().decode(AutocompleteResponse.self, from: data)
        return decoded.data
    }

    func search(query: String, format: String, colorIdentity: String, sort: String) async throws -> [ScryfallCardSearchResult] {
        var terms = [query]
        if !format.isEmpty {
            terms.append("f:\(format)")
        }
        let colors = colorIdentity.lowercased().filter { "wubrg".contains($0) }
        if !colors.isEmpty {
            terms.append("id<=\(colors)")
        }

        var components = URLComponents(string: "https://api.scryfall.com/cards/search")!
        components.queryItems = [
            URLQueryItem(name: "q", value: terms.joined(separator: " ")),
            URLQueryItem(name: "order", value: sort),
            URLQueryItem(name: "unique", value: "cards"),
            URLQueryItem(name: "include_extras", value: "false")
        ]
        let (data, response) = try await session.data(from: components.url!)
        try validate(response)
        let decoded = try JSONDecoder().decode(SearchResponse.self, from: data)
        return decoded.data.map(\.result)
    }

    private func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }
}

private struct AutocompleteResponse: Decodable {
    let data: [String]
}

private struct SearchResponse: Decodable {
    let data: [ScryfallCardDTO]
}

private struct ScryfallCardDTO: Decodable {
    let id: UUID
    let name: String
    let typeLine: String?
    let oracleText: String?
    let manaCost: String?
    let cmc: Double?
    let colorIdentity: [String]?
    let imageUris: ImageUris?
    let cardFaces: [CardFace]?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case typeLine = "type_line"
        case oracleText = "oracle_text"
        case manaCost = "mana_cost"
        case cmc
        case colorIdentity = "color_identity"
        case imageUris = "image_uris"
        case cardFaces = "card_faces"
    }

    var result: ScryfallCardSearchResult {
        ScryfallCardSearchResult(
            id: id,
            name: name,
            typeLine: typeLine ?? cardFaces?.first?.typeLine ?? "",
            oracleText: oracleText ?? cardFaces?.compactMap(\.oracleText).joined(separator: " ") ?? "",
            manaCost: manaCost ?? cardFaces?.first?.manaCost ?? "",
            manaValue: cmc ?? 0,
            colorIdentity: colorIdentity ?? [],
            imageURL: imageUris?.normal ?? imageUris?.large ?? cardFaces?.first?.imageUris?.normal
        )
    }
}

private struct CardFace: Decodable {
    let typeLine: String?
    let oracleText: String?
    let manaCost: String?
    let imageUris: ImageUris?

    enum CodingKeys: String, CodingKey {
        case typeLine = "type_line"
        case oracleText = "oracle_text"
        case manaCost = "mana_cost"
        case imageUris = "image_uris"
    }
}

private struct ImageUris: Decodable {
    let normal: URL?
    let large: URL?
}
