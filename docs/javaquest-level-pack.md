# JavaQuest level content pack

Status: APPROVED by parent on 2026-11-01, all ten levels. Ticket: Author 10-level content pack for parent review (JavaQuest — way to shipped Coolify site).

Locked rules for every level: story at most two sentences, objective one sentence, hint one to two sentences, every sentence at most 20 words. Fixed expected output, exact match after trim. Starter code always gives `public class Main` and `main`; learner writes only new-concept lines. One smallest exact concept token per level, case-sensitive; level 10 uses two earlier tokens. Points: levels 1 to 9 worth 100, level 10 worth 200. Badges: First Print at level 1, Loop Master at level 8, Bug Hunter at level 9.

Reference solutions are parent and build input only. Learners see story, objective, starter code, and hint.

## Level 1 — Volta: Wake Bolt

- **Concept:** print
- **Story:** Bolt sleeps on the launch pad after a long silent night. Cadet, print the wake words so Bolt opens his eyes.
- **Objective:** Use print to show the wake words on screen.

#### Starter code

```java
public class Main {
    public static void main(String[] args) {
        // YOUR CODE BELOW

        // YOUR CODE ABOVE
    }
}
```

#### Reference solution

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Bolt is awake!");
    }
}
```

#### Expected output

```text
Bolt is awake!
```

- **Concept token:** `System.out.println(`
- **Hint:** Printing shows words held inside quotes and round brackets.
- **Points:** 100
- **Badge:** First Print on first pass

## Level 2 — Zorba: Chart Zorba

- **Concept:** variables
- **Story:** Planet Zorba waits beyond the dust belt with two bright moons. Store Zorba in planet and two in moons, Cadet.
- **Objective:** Use variables to remember each Zorba fact.

#### Starter code

```java
public class Main {
    public static void main(String[] args) {
        // YOUR CODE BELOW

        // YOUR CODE ABOVE
        System.out.println(moons);
    }
}
```

#### Reference solution

```java
public class Main {
    public static void main(String[] args) {
        String planet = "Zorba";
        int moons = 2;
        System.out.println(planet);
        System.out.println(moons);
    }
}
```

#### Expected output

```text
Zorba
2
```

- **Concept token:** `String planet`
- **Hint:** Text values wear quotes, but counting numbers never do.
- **Points:** 100

## Level 3 — Cometa: Comet Gate

- **Concept:** branch
- **Story:** A comet gate blocks the lane ahead of Bolt. Storm true means danger, so Bolt must warn Cadet.
- **Objective:** Use a branch to warn Cadet only during storms.

#### Starter code

```java
public class Main {
    public static void main(String[] args) {
        boolean storm = true;
        // YOUR CODE BELOW

        // YOUR CODE ABOVE
    }
}
```

#### Reference solution

```java
public class Main {
    public static void main(String[] args) {
        boolean storm = true;
        if (storm) {
            System.out.println("Hold on, Cadet!");
        }
    }
}
```

#### Expected output

```text
Hold on, Cadet!
```

- **Concept token:** `if (`
- **Hint:** A branch checks one question inside round brackets before acting.
- **Points:** 100

## Level 4 — Trina: Signal Stars

- **Concept:** loop
- **Story:** Three signal stars blink above the quiet Zorba station. Cadet must greet each star once, in rising number order.
- **Objective:** Use a loop to print numbers one to three.

#### Starter code

```java
public class Main {
    public static void main(String[] args) {
        // YOUR CODE BELOW

        // YOUR CODE ABOVE
    }
}
```

#### Reference solution

```java
public class Main {
    public static void main(String[] args) {
        for (int i = 1; i <= 3; i++) {
            System.out.println(i);
        }
    }
}
```

#### Expected output

```text
1
2
3
```

- **Concept token:** `for (`
- **Hint:** A loop repeats its middle lines while its counter climbs.
- **Points:** 100

## Level 5 — Melodia: Launch Song

- **Concept:** method
- **Story:** Bolt hums before every launch, but humming twice repeats code. Teach Bolt one reusable song for both launch calls.
- **Objective:** Use a method to sing Bolt launch song twice.

#### Starter code

```java
public class Main {
    public static void main(String[] args) {
        // CALLS BELOW

        // CALLS ABOVE
    }

    // METHOD BELOW

    // METHOD ABOVE
}
```

#### Reference solution

```java
public class Main {
    public static void main(String[] args) {
        sing();
        sing();
    }

    static void sing() {
        System.out.println("Zoom zoom, Bolt!");
    }
}
```

#### Expected output

```text
Zoom zoom, Bolt!
Zoom zoom, Bolt!
```

- **Concept token:** `static void sing(`
- **Hint:** Write once inside the method, then call its name twice.
- **Points:** 100

## Level 6 — Foundry: Helper Bot

- **Concept:** class
- **Story:** Mission control needs one helper bot beside brave Bolt. Helper bot Pip carries three spare power cells.
- **Objective:** Use a class to build helper bot Pip.

#### Starter code

```java
public class Main {
    public static void main(String[] args) {
        // YOUR CODE BELOW

        // YOUR CODE ABOVE
        System.out.println(pip.cells);
    }

    // CLASS BELOW

    // CLASS ABOVE
}
```

#### Reference solution

```java
public class Main {
    public static void main(String[] args) {
        Robot pip = new Robot();
        pip.name = "Pip";
        pip.cells = 3;
        System.out.println(pip.name);
        System.out.println(pip.cells);
    }
}

class Robot {
    String name;
    int cells;
}
```

#### Expected output

```text
Pip
3
```

- **Concept token:** `class Robot`
- **Hint:** A class draws the bot plan before main builds one.
- **Points:** 100

## Level 7 — Astral: Star Basket

- **Concept:** array
- **Story:** Four loose stars drift near the station supply route. Names Vega, Lyra, Altair, and Deneb need one basket.
- **Objective:** Use an array to hold four star names.

#### Starter code

```java
public class Main {
    public static void main(String[] args) {
        // YOUR CODE BELOW

        // YOUR CODE ABOVE
    }
}
```

#### Reference solution

```java
public class Main {
    public static void main(String[] args) {
        String[] stars = {"Vega", "Lyra", "Altair", "Deneb"};
        System.out.println(stars[0]);
        System.out.println(stars[1]);
        System.out.println(stars[2]);
        System.out.println(stars[3]);
    }
}
```

#### Expected output

```text
Vega
Lyra
Altair
Deneb
```

- **Concept token:** `String[] stars`
- **Hint:** Square brackets hold many values under one basket name.
- **Points:** 100

## Level 8 — Lumina: Window Lights

- **Concept:** combined loops
- **Story:** Station windows form three rows with three lights each. Bolt wants every window light counted without nine commands.
- **Objective:** Use combined loops to count nine window lights.

#### Starter code

```java
public class Main {
    public static void main(String[] args) {
        // YOUR CODE BELOW

        // YOUR CODE ABOVE
    }
}
```

#### Reference solution

```java
public class Main {
    public static void main(String[] args) {
        int count = 0;
        for (int row = 1; row <= 3; row++) {
            for (int col = 1; col <= 3; col++) {
                count++;
            }
        }
        System.out.println(count);
    }
}
```

#### Expected output

```text
9
```

- **Concept token:** `for (` (must appear in both outer and inner loop)
- **Hint:** One loop walks rows while its inner loop walks columns.
- **Points:** 100
- **Badge:** Loop Master on first pass

## Level 9 — Static: Broken Signal

- **Concept:** debug repair
- **Story:** A broken signal hides the rescue word from Bolt. Three faults wait inside code Cadet already knows well.
- **Objective:** Use debug repair to fix three signal faults.

#### Starter code

Learner repairs three lines in place. Faults: missing semicolon on line 3, quoted number on line 4, wrong name on line 5.

```java
public class Main {
    public static void main(String[] args) {
        String word = "Rescue"
        int beeps = "three";
        System.out.println(wurd);
        System.out.println(beeps);
    }
}
```

#### Reference solution

```java
public class Main {
    public static void main(String[] args) {
        String word = "Rescue";
        int beeps = 3;
        System.out.println(word);
        System.out.println(beeps);
    }
}
```

#### Expected output

```text
Rescue
3
```

- **Concept token:** `System.out.println(word);`
- **Hint:** Read each fault line slowly, then match types and names.
- **Points:** 100
- **Badge:** Bug Hunter on first pass

## Level 10 — Haven Station: Rescue Signal

- **Concept:** combined quest
- **Story:** The lost station drifts silent beyond the final planet. Bolt and Cadet must wake every system before rescue.
- **Objective:** Combine earlier skills to send the station rescue signal.

#### Starter code

```java
public class Main {
    public static void main(String[] args) {
        // CALL BELOW

        // CALL ABOVE
    }

    // METHOD BELOW

    // METHOD ABOVE
}
```

#### Reference solution

```java
public class Main {
    public static void main(String[] args) {
        report();
    }

    static void report() {
        String word = "Rescue";
        for (int i = 1; i <= 3; i++) {
            System.out.println(word);
        }
        System.out.println("Station awake!");
    }
}
```

#### Expected output

```text
Rescue
Rescue
Rescue
Station awake!
```

- **Concept tokens:** `for (` and `static void report(`
- **Hint:** Call your method once, then let its loop repeat signal.
- **Points:** 200

## Parent approval

Approve or edit each level. Ticket closes only after all ten levels approve.

- [x] Level 1 — Volta: Wake Bolt
- [x] Level 2 — Zorba: Chart Zorba
- [x] Level 3 — Cometa: Comet Gate
- [x] Level 4 — Trina: Signal Stars
- [x] Level 5 — Melodia: Launch Song
- [x] Level 6 — Foundry: Helper Bot
- [x] Level 7 — Astral: Star Basket
- [x] Level 8 — Lumina: Window Lights
- [x] Level 9 — Static: Broken Signal
- [x] Level 10 — Haven Station: Rescue Signal
