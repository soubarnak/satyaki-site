public class Main {
    public static void main(String[] args) {
        if (isShieldOn() == false && energy() > 10) {
            shield();
        }
        if (distanceAhead() == 0 || distanceAhead() > 5) {
            turnRight();
        } else {
            move();
        }
        move();
        move();
        move();
        move();
        move();
        move();
    }
}
