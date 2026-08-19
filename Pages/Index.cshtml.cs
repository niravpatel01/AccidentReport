using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace AccidentDiagramBuilder.Pages;

public class IndexModel : PageModel
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    public IndexModel(IHttpClientFactory httpClientFactory, IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    public string GoogleMapsBrowserApiKey => _configuration["GoogleMaps:BrowserApiKey"] ?? string.Empty;

    public void OnGet()
    {
    }

    public async Task<IActionResult> OnGetGoogleMapAsync(
        string? address,
        double? latitude,
        double? longitude,
        int zoom = 18,
        CancellationToken cancellationToken = default)
    {
        var hasCoordinates = latitude is >= -90 and <= 90 && longitude is >= -180 and <= 180;
        if (!hasCoordinates && string.IsNullOrWhiteSpace(address))
            return BadRequest(new { message = "Enter a street address or choose a map location." });

        var apiKey = _configuration["GoogleMaps:StaticApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                message = "Google Maps Static API is not configured. Add GoogleMaps:StaticApiKey."
            });

        zoom = Math.Clamp(zoom, 12, 21);
        // A 500x325 map at one lower zoom has the same geographic coverage as
        // the editor's 1000x650 interactive viewport. scale=2 restores full export resolution.
        var staticZoom = zoom - 1;
        var center = hasCoordinates
            ? $"{latitude!.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)},{longitude!.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)}"
            : address!.Trim();
        var mapStyles = new[]
        {
            "feature:all|element:geometry|color:0xf5f6f7",
            "feature:all|element:labels.text.fill|color:0x8a9099",
            "feature:all|element:labels.text.stroke|color:0xffffff",
            "feature:all|element:labels.icon|visibility:off",
            "feature:poi|visibility:off",
            "feature:transit|visibility:off",
            "feature:administrative|visibility:off",
            "feature:landscape|element:labels|visibility:off",
            "feature:road|element:geometry|color:0xd8dde3",
            "feature:road.local|element:geometry|color:0xe5e8ec",
            "feature:road.highway|element:geometry|color:0xcbd2da",
            "feature:road|element:labels.text.fill|color:0x68717d",
            "feature:road|element:labels.text.stroke|color:0xffffff",
            "feature:water|element:geometry|color:0xe7f0f4"
        };
        var styleParameters = string.Concat(mapStyles.Select(style => $"&style={Uri.EscapeDataString(style)}"));
        var mapUrl = $"https://maps.googleapis.com/maps/api/staticmap" +
                     $"?center={Uri.EscapeDataString(center)}" +
                     $"&zoom={staticZoom}&size=500x325&scale=2&maptype=roadmap" +
                     styleParameters +
                     $"&key={Uri.EscapeDataString(apiKey)}";

        try
        {
            using var client = _httpClientFactory.CreateClient();
            using var response = await client.GetAsync(mapUrl, cancellationToken);
            var contentType = response.Content.Headers.ContentType?.MediaType;

            if (!response.IsSuccessStatusCode || contentType is null || !contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            {
                var statusCode = response.IsSuccessStatusCode
                    ? StatusCodes.Status502BadGateway
                    : (int)response.StatusCode;
                return StatusCode(statusCode, new
                {
                    message = "Google Maps could not find or load that location. Verify the address, API key, billing, and Maps Static API settings."
                });
            }

            var bytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
            return File(bytes, contentType);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return StatusCode(499);
        }
        catch (HttpRequestException)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "Google Maps is temporarily unavailable." });
        }
    }
}
