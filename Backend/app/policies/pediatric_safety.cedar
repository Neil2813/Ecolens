// ==============================================================================
// AWS Cedar Policy Language: EcoLens Pediatric School Safety & Commute Matrix
// ==============================================================================
// Open-source authorization & safety specification for vulnerable populations.
// Evaluates EPA Flag Program thresholds for pediatric respiratory protection.

// 1. Permit outdoor play when air quality is in safe or moderate range for healthy students
permit(
    principal in Group::"Students",
    action in [Action::"OutdoorPlay", Action::"StandardRecess"],
    resource == Facility::"SchoolPlayground"
)
when {
    context.outdoor_aqi <= 100 || !context.has_respiratory_vulnerability
};

// 2. Explicitly forbid strenuous athletic exertion during bad air episodes (AQI > 150)
forbid(
    principal,
    action in [Action::"OutdoorAthletics", Action::"CompetitiveSports"],
    resource in [Facility::"AthleticField", Facility::"SchoolPlayground"]
)
when {
    context.outdoor_aqi > 150
};

// 3. Forbid any outdoor recess when air enters Hazardous status (AQI > 200 or PM2.5 > 150)
forbid(
    principal in Group::"Students",
    action in [Action::"OutdoorPlay", Action::"StandardRecess", Action::"OutdoorAthletics"],
    resource
)
when {
    context.outdoor_aqi > 200 || context.outdoor_pm25 > 150.0
};

// 4. Permit school administrators to trigger indoor shelter-in-place and air filtration protocols
permit(
    principal in Role::"SchoolAdministrator",
    action in [Action::"OrderIndoorShelter", Action::"ActivateHEPACirculation"],
    resource in Facility::"SchoolBuilding"
)
when {
    context.outdoor_aqi >= 151
};

// 5. Active commute advisory: Forbid unmasked walking bus commute for sensitive students if AQI > 100
forbid(
    principal in Group::"SensitiveStudents",
    action == Action::"ActiveWalkCommute",
    resource == Route::"SchoolCommute"
)
when {
    context.outdoor_aqi > 100 && !context.wearing_n95_mask
};
