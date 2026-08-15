/*
   GetDP selector for edwin-gray-fem-excitation-event-map/v1.

   Required physical volume IDs are coil-envelope-only regions documented in
   event-map-v1.json. They must not include core material. Each event excites
   exactly three stator/rotor sectors. Positive IDs are front envelopes (+z),
   and negative IDs are their congruent back envelopes (-z).
*/

Group {
  If(EventIndex == 0)
    EventSourcePositive = Region[{2101, 2113, 2125, 2201, 2205, 2209}];
    EventSourceNegative = Region[{2102, 2114, 2126, 2202, 2206, 2210}];
  ElseIf(EventIndex == 1)
    EventSourcePositive = Region[{2103, 2115, 2127, 2203, 2207, 2211}];
    EventSourceNegative = Region[{2104, 2116, 2128, 2204, 2208, 2212}];
  ElseIf(EventIndex == 2)
    EventSourcePositive = Region[{2101, 2113, 2125, 2201, 2205, 2209}];
    EventSourceNegative = Region[{2102, 2114, 2126, 2202, 2206, 2210}];
  ElseIf(EventIndex == 3)
    EventSourcePositive = Region[{2105, 2117, 2129, 2201, 2205, 2209}];
    EventSourceNegative = Region[{2106, 2118, 2130, 2202, 2206, 2210}];
  ElseIf(EventIndex == 4)
    EventSourcePositive = Region[{2107, 2119, 2131, 2203, 2207, 2211}];
    EventSourceNegative = Region[{2108, 2120, 2132, 2204, 2208, 2212}];
  ElseIf(EventIndex == 5)
    EventSourcePositive = Region[{2105, 2117, 2129, 2201, 2205, 2209}];
    EventSourceNegative = Region[{2106, 2118, 2130, 2202, 2206, 2210}];
  ElseIf(EventIndex == 6)
    EventSourcePositive = Region[{2109, 2121, 2133, 2201, 2205, 2209}];
    EventSourceNegative = Region[{2110, 2122, 2134, 2202, 2206, 2210}];
  ElseIf(EventIndex == 7)
    EventSourcePositive = Region[{2111, 2123, 2135, 2203, 2207, 2211}];
    EventSourceNegative = Region[{2112, 2124, 2136, 2204, 2208, 2212}];
  ElseIf(EventIndex == 8)
    EventSourcePositive = Region[{2109, 2121, 2133, 2201, 2205, 2209}];
    EventSourceNegative = Region[{2110, 2122, 2134, 2202, 2206, 2210}];
  ElseIf(EventIndex == 9)
    EventSourcePositive = Region[{2113, 2125, 2101, 2205, 2209, 2201}];
    EventSourceNegative = Region[{2114, 2126, 2102, 2206, 2210, 2202}];
  ElseIf(EventIndex == 10)
    EventSourcePositive = Region[{2115, 2127, 2103, 2207, 2211, 2203}];
    EventSourceNegative = Region[{2116, 2128, 2104, 2208, 2212, 2204}];
  ElseIf(EventIndex == 11)
    EventSourcePositive = Region[{2113, 2125, 2101, 2205, 2209, 2201}];
    EventSourceNegative = Region[{2114, 2126, 2102, 2206, 2210, 2202}];
  ElseIf(EventIndex == 12)
    EventSourcePositive = Region[{2117, 2129, 2105, 2205, 2209, 2201}];
    EventSourceNegative = Region[{2118, 2130, 2106, 2206, 2210, 2202}];
  ElseIf(EventIndex == 13)
    EventSourcePositive = Region[{2119, 2131, 2107, 2207, 2211, 2203}];
    EventSourceNegative = Region[{2120, 2132, 2108, 2208, 2212, 2204}];
  ElseIf(EventIndex == 14)
    EventSourcePositive = Region[{2117, 2129, 2105, 2205, 2209, 2201}];
    EventSourceNegative = Region[{2118, 2130, 2106, 2206, 2210, 2202}];
  ElseIf(EventIndex == 15)
    EventSourcePositive = Region[{2121, 2133, 2109, 2205, 2209, 2201}];
    EventSourceNegative = Region[{2122, 2134, 2110, 2206, 2210, 2202}];
  ElseIf(EventIndex == 16)
    EventSourcePositive = Region[{2123, 2135, 2111, 2207, 2211, 2203}];
    EventSourceNegative = Region[{2124, 2136, 2112, 2208, 2212, 2204}];
  ElseIf(EventIndex == 17)
    EventSourcePositive = Region[{2121, 2133, 2109, 2205, 2209, 2201}];
    EventSourceNegative = Region[{2122, 2134, 2110, 2206, 2210, 2202}];
  ElseIf(EventIndex == 18)
    EventSourcePositive = Region[{2125, 2101, 2113, 2209, 2201, 2205}];
    EventSourceNegative = Region[{2126, 2102, 2114, 2210, 2202, 2206}];
  ElseIf(EventIndex == 19)
    EventSourcePositive = Region[{2127, 2103, 2115, 2211, 2203, 2207}];
    EventSourceNegative = Region[{2128, 2104, 2116, 2212, 2204, 2208}];
  ElseIf(EventIndex == 20)
    EventSourcePositive = Region[{2125, 2101, 2113, 2209, 2201, 2205}];
    EventSourceNegative = Region[{2126, 2102, 2114, 2210, 2202, 2206}];
  ElseIf(EventIndex == 21)
    EventSourcePositive = Region[{2129, 2105, 2117, 2209, 2201, 2205}];
    EventSourceNegative = Region[{2130, 2106, 2118, 2210, 2202, 2206}];
  ElseIf(EventIndex == 22)
    EventSourcePositive = Region[{2131, 2107, 2119, 2211, 2203, 2207}];
    EventSourceNegative = Region[{2132, 2108, 2120, 2212, 2204, 2208}];
  ElseIf(EventIndex == 23)
    EventSourcePositive = Region[{2129, 2105, 2117, 2209, 2201, 2205}];
    EventSourceNegative = Region[{2130, 2106, 2118, 2210, 2202, 2206}];
  ElseIf(EventIndex == 24)
    EventSourcePositive = Region[{2133, 2109, 2121, 2209, 2201, 2205}];
    EventSourceNegative = Region[{2134, 2110, 2122, 2210, 2202, 2206}];
  ElseIf(EventIndex == 25)
    EventSourcePositive = Region[{2135, 2111, 2123, 2211, 2203, 2207}];
    EventSourceNegative = Region[{2136, 2112, 2124, 2212, 2204, 2208}];
  ElseIf(EventIndex == 26)
    EventSourcePositive = Region[{2133, 2109, 2121, 2209, 2201, 2205}];
    EventSourceNegative = Region[{2134, 2110, 2122, 2210, 2202, 2206}];
  EndIf

  DomainWithSourceCurrentDensity = Region[{EventSourcePositive, EventSourceNegative}];
}
